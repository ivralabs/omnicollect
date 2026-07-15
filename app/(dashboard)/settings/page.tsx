import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { user, tenant_id } = await requireTenant();
  const svc = createServiceClient();

  const { data: tenant } = await svc
    .from('tenants')
    .select('name, slug, plan')
    .eq('id', tenant_id)
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/50 mt-1">Account and organisation settings</p>
      </div>

      {/* Account */}
      <div className="bg-white/5 border border-white/8 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-white">Account</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-white/40 mb-1">Email</label>
            <div className="text-sm text-white">{user.email ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Organisation */}
      {tenant && (
        <div className="bg-white/5 border border-white/8 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Organisation</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1">Name</label>
              <div className="text-sm text-white">{tenant.name}</div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Slug</label>
              <div className="text-sm text-white/60 font-mono">{tenant.slug}</div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Plan</label>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] capitalize">
                {tenant.plan}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TODO: Add site API key management, team members, notification preferences */}
    </div>
  );
}
