import Link from 'next/link';
import { Plus, MapPin } from 'lucide-react';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { formatLastSeen, deviceStatus } from '@/lib/utils';
import ScoreBadge from '@/components/dashboard/ScoreBadge';

export const metadata = { title: 'Sites' };

const SITE_TYPE_LABELS: Record<string, string> = {
  billboard: 'Billboard',
  screen: 'Digital Screen',
  street_furniture: 'Street Furniture',
};

export default async function SitesPage() {
  const { tenant_id } = await requireTenant();
  const svc = createServiceClient();

  const { data: sites } = await svc
    .from('sites')
    .select('id, name, address, site_type, omnicollect_score, last_seen_at, is_active, device_id')
    .eq('tenant_id', tenant_id)
    .order('name', { ascending: true });

  const allSites = sites ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Sites</h1>
          <p className="text-sm text-white/50 mt-1">{allSites.length} site{allSites.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Link
          href="/sites/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14B8A6] hover:bg-[#0d9488] text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Site
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Site</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Score</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Last Seen</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {allSites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <MapPin className="w-8 h-8 text-white/20" />
                      <div>
                        <p className="text-sm text-white/50 font-medium">No sites yet</p>
                        <p className="text-xs text-white/30 mt-1">Add your first site to start collecting data</p>
                      </div>
                      <Link
                        href="/sites/new"
                        className="mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14B8A6] text-white text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Site
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                allSites.map((site) => {
                  const status = deviceStatus(site.last_seen_at);
                  return (
                    <tr key={site.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/sites/${site.id}`} className="text-white hover:text-[#14B8A6] font-medium transition-colors">
                          {site.name}
                        </Link>
                        {site.address && (
                          <div className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {site.address}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-white/60">
                        {SITE_TYPE_LABELS[site.site_type ?? 'billboard'] ?? site.site_type}
                      </td>
                      <td className="px-5 py-3.5">
                        <ScoreBadge score={site.omnicollect_score ?? 0} size="sm" />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status === 'online' ? 'text-green-400' : 'text-white/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400' : 'bg-white/20'}`} />
                          {status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs">
                        {formatLastSeen(site.last_seen_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/sites/${site.id}`}
                          className="text-xs text-[#14B8A6] hover:text-[#0d9488] transition-colors"
                        >
                          View
                        </Link>
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
