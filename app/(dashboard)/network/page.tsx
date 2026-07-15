import { Network } from 'lucide-react';
import { requireTenant } from '@/lib/auth';
import NetworkClient from './NetworkClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Network Intelligence',
};

export default async function NetworkPage() {
  // Auth gate — throws & redirects handled by layout if needed
  await requireTenant();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center">
              <Network className="w-4 h-4 text-[#14B8A6]" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Network Intelligence</h1>
          </div>
          <p className="text-sm text-white/40 mt-1.5">
            Cross-site vehicle journeys — prove unique reach across your network
          </p>
        </div>
        <div className="text-xs text-white/30 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
          Last 30 days
        </div>
      </div>

      <NetworkClient days={30} />
    </div>
  );
}
