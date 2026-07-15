import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Network } from 'lucide-react';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import NetworkClient from '../NetworkClient';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ campaignId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaignId } = await params;
  const svc = createServiceClient();
  const { data } = await svc.from('campaigns').select('name').eq('id', campaignId).maybeSingle();
  return { title: data ? `${data.name} — Journey Report` : 'Campaign Journey Report' };
}

export default async function CampaignJourneyPage({ params }: Props) {
  const { campaignId } = await params;
  const { tenant_id } = await requireTenant();
  const svc = createServiceClient();

  const { data: campaign } = await svc
    .from('campaigns')
    .select('id, name, start_date, end_date')
    .eq('id', campaignId)
    .eq('tenant_id', tenant_id)
    .maybeSingle();

  if (!campaign) notFound();

  const start = new Date(campaign.start_date);
  const end = campaign.end_date ? new Date(campaign.end_date) : new Date();
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/network"
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Network
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center">
              <Network className="w-4 h-4 text-[#14B8A6]" />
            </div>
            <h1 className="text-2xl font-semibold text-white">{campaign.name}</h1>
          </div>
          <p className="text-sm text-white/40 mt-1.5">
            Campaign Journey Report · {fmt(start)} – {fmt(end)}
          </p>
        </div>
        <div className="text-xs text-white/30 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
          {days} day{days !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Scoped to campaign window */}
      <NetworkClient days={days} />
    </div>
  );
}
