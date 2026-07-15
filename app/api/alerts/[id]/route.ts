import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

// PATCH /api/alerts/[id] — resolves an alert
// Body: { resolved: true }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenant_id } = await requireTenant();
    const { id } = await params;
    const svc = createServiceClient();

    // Verify alert belongs to tenant (via site ownership)
    const { data: alert } = await svc
      .from('site_alerts')
      .select('id, site_id, sites!inner(tenant_id)')
      .eq('id', id)
      .single();

    if (!alert) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const sitesRel = Array.isArray(alert.sites) ? alert.sites[0] : alert.sites;
    if (!sitesRel || (sitesRel as { tenant_id: string }).tenant_id !== tenant_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await svc
      .from('site_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHENTICATED' || msg === 'NO_TENANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
