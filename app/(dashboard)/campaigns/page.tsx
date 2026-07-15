import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { BarChart2, Plus } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Campaigns' };

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10',
  completed: 'text-white/40 bg-white/5',
  draft: 'text-yellow-400 bg-yellow-400/10',
};

export default async function CampaignsPage() {
  const { tenant_id } = await requireTenant();
  const svc = createServiceClient();

  const { data: campaigns } = await svc
    .from('campaigns')
    .select('id, name, brand, start_date, end_date, status, site_ids')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });

  const allCampaigns = campaigns ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Campaigns</h1>
          <p className="text-sm text-white/50 mt-1">{allCampaigns.length} campaign{allCampaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14B8A6] hover:bg-[#0d9488] text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {allCampaigns.length === 0 ? (
        <div className="bg-white/5 border border-white/8 rounded-xl py-16 flex flex-col items-center gap-3">
          <BarChart2 className="w-10 h-10 text-white/20" />
          <div className="text-center">
            <p className="text-sm font-medium text-white">No campaigns yet</p>
            <p className="text-xs text-white/40 mt-1">Create a campaign to overlay it on your site data</p>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Campaign</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Brand</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Dates</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Sites</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {allCampaigns.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-5 py-3.5 text-white font-medium">{c.name}</td>
                  <td className="px-5 py-3.5 text-white/60">{c.brand ?? '—'}</td>
                  <td className="px-5 py-3.5 text-white/50 text-xs">
                    {new Date(c.start_date).toLocaleDateString('en-ZA')} –{' '}
                    {new Date(c.end_date).toLocaleDateString('en-ZA')}
                  </td>
                  <td className="px-5 py-3.5 text-white/50">{(c.site_ids ?? []).length}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[c.status] ?? ''}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
