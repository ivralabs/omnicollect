import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Car, Eye, Clock, TrendingUp, AlertTriangle, Settings } from 'lucide-react';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { formatLastSeen, deviceStatus } from '@/lib/utils';
import ScoreBadge from '@/components/dashboard/ScoreBadge';
import StatCard from '@/components/dashboard/StatCard';
import SiteCharts from '@/components/dashboard/SiteCharts';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const svc = createServiceClient();
  const { data } = await svc.from('sites').select('name').eq('id', id).maybeSingle();
  return { title: data?.name ?? 'Site' };
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10',
  warning: 'text-yellow-400 bg-yellow-400/10',
  info: 'text-blue-400 bg-blue-400/10',
};

export default async function SitePage({ params }: Props) {
  const { id } = await params;
  const { tenant_id } = await requireTenant();
  const svc = createServiceClient();

  // Fetch site — verify tenant ownership
  const { data: site } = await svc
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenant_id)
    .maybeSingle();

  if (!site) notFound();

  const status = deviceStatus(site.last_seen_at);

  // Today's window
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 24h window for charts
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Today's readings summary
  const { data: todayReadings } = await svc
    .from('site_readings')
    .select('vehicle_count, unique_plate_hashes, avg_dwell_secs, vehicle_classes, window_start')
    .eq('site_id', id)
    .gte('window_start', today.toISOString())
    .order('window_start', { ascending: true });

  const readings = todayReadings ?? [];
  const totalVehicles = readings.reduce((s, r) => s + (r.vehicle_count ?? 0), 0);
  const totalUnique = readings.reduce((s, r) => s + (r.unique_plate_hashes ?? 0), 0);
  const avgDwell =
    readings.length > 0
      ? Math.round(readings.reduce((s, r) => s + Number(r.avg_dwell_secs ?? 0), 0) / readings.length)
      : 0;

  // Peak hour
  let peakHour = 'N/A';
  if (readings.length > 0) {
    const peak = readings.reduce((best, r) => (r.vehicle_count > best.vehicle_count ? r : best), readings[0]);
    peakHour = new Date(peak.window_start).getHours().toString().padStart(2, '0') + ':00';
  }

  // Last 24h hourly data for chart
  const { data: hourlyReadings } = await svc
    .from('site_readings')
    .select('vehicle_count, vehicle_classes, window_start')
    .eq('site_id', id)
    .gte('window_start', yesterday.toISOString())
    .order('window_start', { ascending: true });

  // Aggregate by hour
  const hourlyMap: Record<string, number> = {};
  for (let h = 0; h < 24; h++) {
    hourlyMap[h.toString().padStart(2, '0') + ':00'] = 0;
  }
  for (const r of hourlyReadings ?? []) {
    const hour = new Date(r.window_start).getHours().toString().padStart(2, '0') + ':00';
    hourlyMap[hour] = (hourlyMap[hour] ?? 0) + (r.vehicle_count ?? 0);
  }
  const hourlyData = Object.entries(hourlyMap).map(([hour, vehicles]) => ({ hour, vehicles }));

  // Vehicle class breakdown aggregated from today's readings
  const classMap: Record<string, number> = {};
  for (const r of readings) {
    const classes = (r.vehicle_classes ?? {}) as Record<string, number>;
    for (const [cls, count] of Object.entries(classes)) {
      classMap[cls] = (classMap[cls] ?? 0) + count;
    }
  }
  const vehicleClassData = Object.entries(classMap).map(([name, value]) => ({ name, value }));

  // Recent alerts
  const { data: alerts } = await svc
    .from('site_alerts')
    .select('id, alert_type, severity, triggered_at, details')
    .eq('site_id', id)
    .is('resolved_at', null)
    .order('triggered_at', { ascending: false })
    .limit(5);

  // Last 10 readings
  const { data: latestReadings } = await svc
    .from('site_readings')
    .select('id, window_start, window_end, vehicle_count, people_count, unique_plate_hashes, avg_dwell_secs, weather_condition')
    .eq('site_id', id)
    .order('window_start', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/sites" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Sites
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">{site.name}</h1>
              <ScoreBadge score={site.omnicollect_score ?? 0} />
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status === 'online' ? 'text-green-400' : 'text-white/30'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                {status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
            {site.address && <p className="text-sm text-white/40 mt-1">{site.address}</p>}
            <p className="text-xs text-white/30 mt-1">Last seen {formatLastSeen(site.last_seen_at)}</p>
          </div>
          <Link
            href={`/sites/${site.id}/settings`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Vehicles Today" value={totalVehicles.toLocaleString('en-ZA')} icon={Car} />
        <StatCard title="Unique Reach" value={totalUnique.toLocaleString('en-ZA')} icon={Eye} subtitle="unique plate hashes" />
        <StatCard title="Avg Dwell Time" value={`${avgDwell}s`} icon={Clock} />
        <StatCard title="Peak Hour" value={peakHour} icon={TrendingUp} />
      </div>

      {/* Charts */}
      <SiteCharts hourlyData={hourlyData} vehicleClassData={vehicleClassData} />

      {/* Alerts */}
      {(alerts ?? []).length > 0 && (
        <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Active Alerts
            </h2>
          </div>
          <div className="divide-y divide-white/5">
            {(alerts ?? []).map((alert) => (
              <div key={alert.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm text-white font-medium">{alert.alert_type.replace(/_/g, ' ')}</span>
                  <p className="text-xs text-white/40 mt-0.5">{formatLastSeen(alert.triggered_at)}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY_COLORS[alert.severity] ?? 'text-white/50'}`}>
                  {alert.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last 10 readings */}
      <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-medium text-white">Recent Readings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Window</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Vehicles</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">People</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Unique</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Avg Dwell</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Weather</th>
              </tr>
            </thead>
            <tbody>
              {(latestReadings ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-white/30">No readings yet</td>
                </tr>
              ) : (
                (latestReadings ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-5 py-3 text-white/60 text-xs">
                      {new Date(r.window_start).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(r.window_end).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-white font-medium">{r.vehicle_count}</td>
                    <td className="px-5 py-3 text-white/60">{r.people_count}</td>
                    <td className="px-5 py-3 text-white/60">{r.unique_plate_hashes}</td>
                    <td className="px-5 py-3 text-white/60">{r.avg_dwell_secs}s</td>
                    <td className="px-5 py-3 text-white/40">{r.weather_condition ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
