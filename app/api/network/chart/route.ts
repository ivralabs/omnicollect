import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/network/chart?hours=24
// Returns hourly vehicle counts for all tenant sites over the last N hours.
export async function GET(req: NextRequest) {
  try {
    const { tenant_id } = await requireTenant();
    const svc = createServiceClient();

    const url = new URL(req.url);
    const hours = Math.min(parseInt(url.searchParams.get('hours') ?? '24', 10), 168); // cap at 7 days

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Get tenant site IDs
    const { data: sitesData } = await svc
      .from('sites')
      .select('id')
      .eq('tenant_id', tenant_id);

    const siteIds = (sitesData ?? []).map((s: { id: string }) => s.id);

    if (siteIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch all readings in range and aggregate by hour in JS
    const { data: readings, error } = await svc
      .from('site_readings')
      .select('window_start, vehicle_count')
      .in('site_id', siteIds)
      .gte('window_start', since)
      .order('window_start', { ascending: true });

    if (error) {
      console.error('[network/chart] readings query error:', error);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    // Aggregate by truncated hour
    const hourMap = new Map<string, number>();
    for (const row of readings ?? []) {
      const d = new Date(row.window_start);
      d.setMinutes(0, 0, 0);
      const key = d.toISOString();
      hourMap.set(key, (hourMap.get(key) ?? 0) + (row.vehicle_count ?? 0));
    }

    const data = Array.from(hourMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, vehicles]) => ({ hour, vehicles }));

    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    if (msg === 'UNAUTHENTICATED' || msg === 'NO_TENANT') {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error('[network/chart]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
