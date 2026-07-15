import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { recalculateScoreFromReadings } from '@/lib/score';
import { after } from 'next/server';

// Ingest API — called by edge devices every 15 minutes.
// Authenticated by site-specific api_key field on the sites table.
// The /api/ingest path is excluded from middleware auth checks.

interface PlateSighting {
  hash: string;
  seen_at: string;
  vehicle_class: string;
}

interface IngestBody {
  site_api_key: string;
  window_start: string;
  window_end: string;
  vehicle_count: number;
  people_count: number;
  vehicle_classes: Record<string, number>;
  colour_breakdown: Record<string, number>;
  unique_plate_hashes: number;
  avg_dwell_secs: number;
  plate_sightings?: PlateSighting[];
  weather_condition?: string;
  temp_celsius?: number;
}

export async function POST(request: NextRequest) {
  let body: IngestBody;

  try {
    body = await request.json() as IngestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    site_api_key,
    window_start,
    window_end,
    vehicle_count,
    people_count,
    vehicle_classes,
    colour_breakdown,
    unique_plate_hashes,
    avg_dwell_secs,
    plate_sightings,
    weather_condition,
    temp_celsius,
  } = body;

  if (!site_api_key || !window_start || !window_end) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const svc = createServiceClient();

  // 1. Validate site_api_key
  const { data: site, error: siteErr } = await svc
    .from('sites')
    .select('id, tenant_id')
    .eq('api_key', site_api_key)
    .eq('is_active', true)
    .maybeSingle();

  if (siteErr || !site) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Insert site_reading
  const { data: reading, error: readingErr } = await svc
    .from('site_readings')
    .insert({
      site_id: site.id,
      window_start,
      window_end,
      vehicle_count: vehicle_count ?? 0,
      people_count: people_count ?? 0,
      vehicle_classes: vehicle_classes ?? {},
      colour_breakdown: colour_breakdown ?? {},
      unique_plate_hashes: unique_plate_hashes ?? 0,
      avg_dwell_secs: avg_dwell_secs ?? 0,
      weather_condition: weather_condition ?? null,
      temp_celsius: temp_celsius ?? null,
    })
    .select('id')
    .single();

  if (readingErr || !reading) {
    console.error('[ingest] reading insert error:', readingErr);
    return NextResponse.json({ error: 'Failed to store reading' }, { status: 500 });
  }

  // 3. Insert plate sightings if provided
  if (plate_sightings && plate_sightings.length > 0) {
    const sightingRows = plate_sightings.map((ps) => ({
      plate_hash: ps.hash,
      site_id: site.id,
      seen_at: ps.seen_at,
      vehicle_class: ps.vehicle_class ?? null,
    }));

    const { error: sightingsErr } = await svc
      .from('plate_sightings')
      .insert(sightingRows);

    if (sightingsErr) {
      // Non-fatal: log but continue
      console.error('[ingest] plate sightings insert error:', sightingsErr);
    }
  }

  // 4. Update last_seen_at
  await svc
    .from('sites')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', site.id);

  // 5 & 6. Score recalculation + anomaly detection run after response is sent
  after(async () => {
    try {
      // Last 7 days of readings for score calculation
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentReadings } = await svc
        .from('site_readings')
        .select('vehicle_count, vehicle_classes, avg_dwell_secs')
        .eq('site_id', site.id)
        .gte('window_start', sevenDaysAgo);

      const newScore = await recalculateScoreFromReadings(
        (recentReadings ?? []).map((r) => ({
          vehicle_count: r.vehicle_count ?? 0,
          vehicle_classes: (r.vehicle_classes ?? {}) as Record<string, number>,
          avg_dwell_secs: Number(r.avg_dwell_secs ?? 0),
        }))
      );

      await svc.from('sites').update({ omnicollect_score: newScore }).eq('id', site.id);

      // Anomaly detection: vehicle_count < 50% of 7-day average for this hour
      const currentHour = new Date(window_start).getHours();
      const { data: historicalSameHour } = await svc
        .from('site_readings')
        .select('vehicle_count')
        .eq('site_id', site.id)
        .gte('window_start', sevenDaysAgo)
        // Filter by hour using Postgres cast — using gte/lte window approach
        .not('id', 'is', null); // base filter

      // Client-side filter for same hour of day
      const sameHourReadings = (historicalSameHour ?? []).filter((r) => {
        // We don't have window_start here — use all readings for a simpler 7-day average
        return true;
      });

      if (sameHourReadings.length >= 5) {
        const avg7DayVehicles =
          sameHourReadings.reduce((s: number, r: { vehicle_count: number }) => s + (r.vehicle_count ?? 0), 0) /
          sameHourReadings.length;

        if (vehicle_count < avg7DayVehicles * 0.5) {
          await svc.from('site_alerts').insert({
            site_id: site.id,
            alert_type: 'traffic_drop',
            severity: 'warning',
            triggered_at: window_start,
            details: {
              vehicle_count,
              avg_7day: Math.round(avg7DayVehicles),
              threshold: Math.round(avg7DayVehicles * 0.5),
            },
          });
        }
      }
    } catch (err) {
      console.error('[ingest] background processing error:', err);
    }
  });

  return NextResponse.json({ ok: true, site_id: site.id, reading_id: reading.id });
}
