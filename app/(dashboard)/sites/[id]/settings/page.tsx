import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings2, Shield, Trash2 } from 'lucide-react';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { deviceStatus, formatLastSeen } from '@/lib/utils';
import SiteSettingsForm from './SiteSettingsForm';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const svc = createServiceClient();
  const { data } = await svc.from('sites').select('name').eq('id', id).maybeSingle();
  return { title: data?.name ? `${data.name} - Settings` : 'Site Settings' };
}

export default async function SiteSettingsPage({ params }: Props) {
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

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href={`/sites/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Site
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
              <Settings2 className="w-6 h-6 text-[#14B8A6]" />
              Site Settings
            </h1>
            <p className="text-sm text-white/50 mt-1">{site.name}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              status === 'online' ? 'text-green-400' : 'text-white/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}
            />
            {status === 'online' ? 'Online' : 'Offline'}
            {site.last_seen_at && (
              <span className="text-white/30 ml-1">(last seen {formatLastSeen(site.last_seen_at)})</span>
            )}
          </span>
        </div>
      </div>

      <SiteSettingsForm site={site} />
    </div>
  );
}
