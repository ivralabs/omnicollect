import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { formatLastSeen } from '@/lib/utils';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import ResolveAlertButton from '@/components/dashboard/ResolveAlertButton';

export const metadata = { title: 'Alerts' };

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  warning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export default async function AlertsPage() {
  const { tenant_id } = await requireTenant();
  const svc = createServiceClient();

  // Fetch unresolved alerts for all sites in this tenant
  const { data: alerts } = await svc
    .from('site_alerts')
    .select('id, alert_type, severity, triggered_at, details, site_id, sites(name)')
    .is('resolved_at', null)
    .in(
      'site_id',
      (await svc.from('sites').select('id').eq('tenant_id', tenant_id)).data?.map((s: { id: string }) => s.id) ?? []
    )
    .order('triggered_at', { ascending: false });

  const activeAlerts = alerts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Alerts</h1>
          <p className="text-sm text-white/50 mt-1">
            {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="bg-white/5 border border-white/8 rounded-xl py-16 flex flex-col items-center gap-3">
          <CheckCircle className="w-10 h-10 text-green-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-white">All clear</p>
            <p className="text-xs text-white/40 mt-1">No active alerts across your network</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map((alert) => {
            const site = Array.isArray(alert.sites) ? alert.sites[0] : alert.sites;
            return (
              <div
                key={alert.id}
                className={`bg-white/5 border rounded-xl p-5 flex items-start justify-between gap-4 ${SEVERITY_COLORS[alert.severity] ?? 'border-white/8'}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${alert.severity === 'critical' ? 'text-red-400' : alert.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white capitalize">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY_COLORS[alert.severity]?.split(' ').slice(0, 2).join(' ')}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {site && (
                        <Link href={`/sites/${alert.site_id}`} className="text-xs text-[#14B8A6] hover:text-[#0d9488] transition-colors">
                          {site.name}
                        </Link>
                      )}
                      <span className="text-xs text-white/30">·</span>
                      <span className="text-xs text-white/40">{formatLastSeen(alert.triggered_at)}</span>
                    </div>
                  </div>
                </div>
                <ResolveAlertButton alertId={alert.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
