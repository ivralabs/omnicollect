import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

// PATCH /api/sites/[id]
// Update site details OR regenerate API key

interface UpdateSiteBody {
  name?: string;
  address?: string;
  site_type?: string;
  facing?: string;
  gps_lat?: number | null;
  gps_lng?: number | null;
  screen_width_mm?: number | null;
  screen_height_mm?: number | null;
  is_active?: boolean;
  regenerate_key?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { tenant_id } = await requireTenant();

    // Parse and validate body
    let body: UpdateSiteBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const svc = createServiceClient();

    // Verify site exists and belongs to tenant
    const { data: existingSite } = await svc
      .from('sites')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (!existingSite) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Handle regenerate_key
    if (body.regenerate_key === true) {
      const newApiKey = `oc_site_${randomUUID().replace(/-/g, '').slice(0, 32)}`;

      const { error } = await svc
        .from('sites')
        .update({ api_key: newApiKey })
        .eq('id', id)
        .eq('tenant_id', tenant_id);

      if (error) {
        console.error('[api/sites/[id]] regenerate key error:', error);
        return NextResponse.json({ error: 'Failed to regenerate API key' }, { status: 500 });
      }

      return NextResponse.json({ api_key: newApiKey });
    }

    // Validate site_type if provided
    if (body.site_type) {
      const validTypes = ['billboard', 'screen', 'street_furniture', 'transit'];
      if (!validTypes.includes(body.site_type)) {
        return NextResponse.json(
          { error: `Invalid site_type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.address !== undefined) updateData.address = body.address.trim();
    if (body.site_type !== undefined) updateData.site_type = body.site_type;
    if (body.facing !== undefined) updateData.facing = body.facing || null;
    if (body.gps_lat !== undefined) updateData.gps_lat = body.gps_lat;
    if (body.gps_lng !== undefined) updateData.gps_lng = body.gps_lng;
    if (body.screen_width_mm !== undefined) updateData.screen_width_mm = body.screen_width_mm;
    if (body.screen_height_mm !== undefined) updateData.screen_height_mm = body.screen_height_mm;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Only update if there's something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: site, error } = await svc
      .from('sites')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select('id, name, address, site_type, facing, gps_lat, gps_lng, screen_width_mm, screen_height_mm, is_active, updated_at')
      .single();

    if (error) {
      console.error('[api/sites/[id]] update error:', error);
      return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
    }

    return NextResponse.json({ site });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'NO_TENANT') {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 403 });
    }
    console.error('[api/sites/[id]] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/sites/[id]
// Delete site and all related data

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { tenant_id } = await requireTenant();

    const svc = createServiceClient();

    // Verify site exists and belongs to tenant
    const { data: existingSite } = await svc
      .from('sites')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (!existingSite) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Delete site (RLS + cascade will handle related data)
    const { error } = await svc
      .from('sites')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) {
      console.error('[api/sites/[id]] delete error:', error);
      return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'NO_TENANT') {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 403 });
    }
    console.error('[api/sites/[id]] unexpected delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
