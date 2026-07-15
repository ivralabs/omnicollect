import { MapPin, Activity, Car, Star } from 'lucide-react';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { formatLastSeen, deviceStatus } from '@/lib/utils';
import StatCard from '@/components/dashboard/StatCard';
import ScoreBadge from '@/components/dashboard/ScoreBadge';
import NetworkChart from '@/components/dashboard/NetworkChart';
import Link from 'next/link';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const { tenant_id } = await requireTenant();
  const svc = createServiceClient();

  // Fetch all sites for this tenant
  const { data: sites } = await svc
    .from('sites')
    .select('id, name, address, omnicollect_score, last_seen_at, is_active')
    .eq('tenant_id', tenant_id)
    .order('name', { ascending: true });

  const allSites = sites ?? [];
  const activeSites = allSites.filter((s) => deviceStatus(s.last_seen_at) === 'online');
  const avgScore =
    allSites.length > 0
      ? Math.round(allSites.reduce((sum, s) => sum + (s.omnicollect_score ?? 0), 0) / allSites.length)
      : 0;

  // Today's total vehicles across all sites
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayReadings } = await svc
    .from('site_readings')
    .select('vehicle_count, site_id')
    .in('site_id', allSites.map((s) => s.id))
    .gte('window_start', today.toISOString());

  const totalVehiclesToday = (todayReadings ?? []).reduce((sum, r) => sum + (r.vehicle_count ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Network Overview</h1>
        <p className="text-sm text-white/50 mt-1">All sites across your outdoor media network</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Sites"
          value={allSites.length}
          icon={MapPin}
          subtitle="registered on platform"
        />
        <StatCard
          title="Active Sites"
          value={activeSites.length}
          icon={Activity}
          subtitle="online in last 30 min"
        />
        <StatCard
          title="Vehicles Today"
          value={totalVehiclesToday.toLocaleString('en-ZA')}
          icon={Car}
          subtitle="across all sites"
        />
        <StatCard
          title="Avg OmniCollect Score"
          value={avgScore}
          icon={Star}
          subtitle="network average"
        />
      </div>

      {/* 24h chart */}
      <NetworkChart />

      {/* Sites table */}
      <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">All Sites</h2>
          <Link
            href="/sites"
            className="text-xs text-[#14B8A6] hover:text-[#0d9488] transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Site</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Score</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Last Seen</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {allSites.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-white/30">
                    No sites yet. Add your first site to get started.
                  </td>
                </tr>
              ) : (
                allSites.map((site) => {
                  const status = deviceStatus(site.last_seen_at);
                  return (
                    <tr key={site.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/sites/${site.id}`} className="text-white hover:text-[#14B8A6] transition-colors font-medium">
                          {site.name}
                        </Link>
                        {site.address && (
                          <div className="text-xs text-white/30 mt-0.5">{site.address}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <ScoreBadge score={site.omnicollect_score ?? 0} size="sm" />
                      </td>
                      <td className="px-5 py-3.5 text-white/50">
                        {formatLastSeen(site.last_seen_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status === 'online' ? 'text-green-400' : 'text-white/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : 'bg-white/20'}`} />
                          {status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
