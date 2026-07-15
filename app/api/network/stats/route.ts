import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  try {
    const { tenant_id } = await requireTenant();
    const svc = createServiceClient();

    const url = new URL(req.url);
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const days = parseInt(url.searchParams.get('days') ?? '30', 10);

    // If explicit date range provided, use it; otherwise compute from `days`
    const since = dateFrom ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const until = dateTo ?? new Date().toISOString();

    // ── 1. Unique vehicles — computed via JS aggregation below
    let unique_vehicles = 0;

    // ── 2. All plate sightings for this tenant in window (for JS aggregation) ─
    const { data: sightings } = await svc
      .from('plate_sightings')
      .select('plate_hash, site_id')
      .in(
        'site_id',
        await (async () => {
          const { data } = await svc
            .from('sites')
            .select('id')
            .eq('tenant_id', tenant_id);
          return (data ?? []).map((s: { id: string }) => s.id);
        })()
      )
      .gte('seen_at', since)
      .lte('seen_at', until);

    // ── 3. Fetch site names ───────────────────────────────────────────────────
    const { data: sitesData } = await svc
      .from('sites')
      .select('id, name')
      .eq('tenant_id', tenant_id);

    const siteMap: Record<string, string> = {};
    for (const s of sitesData ?? []) siteMap[s.id] = s.name;

    const allSightings = sightings ?? [];

    // ── 4. Compute summary ───────────────────────────────────────────────────
    // plate_hash → Set<site_id>
    const plateToSites = new Map<string, Set<string>>();
    for (const row of allSightings) {
      if (!plateToSites.has(row.plate_hash)) plateToSites.set(row.plate_hash, new Set());
      plateToSites.get(row.plate_hash)!.add(row.site_id);
    }

    unique_vehicles = plateToSites.size;
    let cross_site_travellers = 0;
    let total_frequency = 0;

    for (const sites of plateToSites.values()) {
      if (sites.size >= 2) cross_site_travellers++;
      total_frequency += sites.size;
    }

    const network_reach_rate =
      unique_vehicles > 0 ? Math.round((cross_site_travellers / unique_vehicles) * 100 * 10) / 10 : 0;
    const avg_frequency =
      unique_vehicles > 0 ? Math.round((total_frequency / unique_vehicles) * 10) / 10 : 0;

    // ── 5. Overlap matrix ────────────────────────────────────────────────────
    // site_a:site_b → Set<plate_hash>
    const overlapMap = new Map<string, Set<string>>();
    for (const [plate, sites] of plateToSites.entries()) {
      const sitesArr = Array.from(sites);
      for (let i = 0; i < sitesArr.length; i++) {
        for (let j = i + 1; j < sitesArr.length; j++) {
          // Canonical key (sorted) so A::B and B::A are the same pair
          const key = [sitesArr[i], sitesArr[j]].sort().join('::');
          if (!overlapMap.has(key)) overlapMap.set(key, new Set());
          overlapMap.get(key)!.add(plate);
        }
      }
    }

    // For each canonical pair, emit two entries (A→B and B→A) so the
    // symmetric matrix lookup in the UI works with both key directions.
    const overlap_matrix: Array<{
      site_a_id: string; site_a_name: string;
      site_b_id: string; site_b_name: string;
      shared_vehicles: number;
    }> = [];
    for (const [key, plates] of overlapMap.entries()) {
      const [a, b] = key.split('::');
      const count = plates.size;
      overlap_matrix.push({ site_a_id: a, site_a_name: siteMap[a] ?? a, site_b_id: b, site_b_name: siteMap[b] ?? b, shared_vehicles: count });
      overlap_matrix.push({ site_a_id: b, site_a_name: siteMap[b] ?? b, site_b_id: a, site_b_name: siteMap[a] ?? a, shared_vehicles: count });
    }

    // ── 6. Frequency distribution ────────────────────────────────────────────
    const freqMap = new Map<number, number>();
    for (const sites of plateToSites.values()) {
      const count = sites.size;
      freqMap.set(count, (freqMap.get(count) ?? 0) + 1);
    }
    // Bucket 5+ together
    const freq5plus = Array.from(freqMap.entries())
      .filter(([k]) => k >= 5)
      .reduce((s, [, v]) => s + v, 0);

    const frequency_distribution = [1, 2, 3, 4]
      .map((n) => ({ times_seen: n, vehicle_count: freqMap.get(n) ?? 0 }))
      .concat([{ times_seen: 5, vehicle_count: freq5plus }]);

    // ── 7. Top journeys ──────────────────────────────────────────────────────
    // site → unique vehicle count (for pct)
    const siteUnique = new Map<string, Set<string>>();
    for (const [plate, sites] of plateToSites.entries()) {
      for (const s of sites) {
        if (!siteUnique.has(s)) siteUnique.set(s, new Set());
        siteUnique.get(s)!.add(plate);
      }
    }

    const top_journeys = overlap_matrix
      .map((entry) => ({
        from_site: entry.site_a_name,
        to_site: entry.site_b_name,
        shared_vehicles: entry.shared_vehicles,
        pct_of_from:
          siteUnique.get(entry.site_a_id)?.size
            ? Math.round((entry.shared_vehicles / siteUnique.get(entry.site_a_id)!.size) * 100)
            : 0,
      }))
      .sort((a, b) => b.shared_vehicles - a.shared_vehicles)
      .slice(0, 20);

    // ── 8. Site reach ────────────────────────────────────────────────────────
    const site_reach = Array.from(siteUnique.entries()).map(([site_id, plates]) => {
      let crossSiteCount = 0;
      let totalSiteFreq = 0;
      for (const plate of plates) {
        const allSites = plateToSites.get(plate)!;
        if (allSites.size >= 2) crossSiteCount++;
        totalSiteFreq += allSites.size;
      }
      return {
        site_id,
        site_name: siteMap[site_id] ?? site_id,
        unique_vehicles: plates.size,
        cross_site_pct: plates.size > 0 ? Math.round((crossSiteCount / plates.size) * 100) : 0,
        avg_frequency: plates.size > 0 ? Math.round((totalSiteFreq / plates.size) * 10) / 10 : 0,
      };
    });

    return NextResponse.json({
      summary: { unique_vehicles, cross_site_travellers, network_reach_rate, avg_frequency },
      overlap_matrix,
      frequency_distribution,
      top_journeys,
      site_reach,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    if (msg === 'UNAUTHENTICATED' || msg === 'NO_TENANT') {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error('[network/stats]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
