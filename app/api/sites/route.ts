import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireTenant } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/sites
// Creates a new site and generates a unique API key for the edge device
// Returns the api_key ONCE — it's stored hashed in production (plain for now)

interface CreateSiteBody {
  name: string;
  address: string;
  site_type: string;
  facing?: string;
  gps_lat?: number;
  gps_lng?: number;
  screen_width_mm?: number;
  screen_height_mm?: number;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Require authenticated tenant user
    const { tenant_id } = await requireTenant();

    // 2. Parse and validate body
    let body: CreateSiteBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, address, site_type } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Site name is required' }, { status: 400 });
    }
    if (!address || typeof address !== 'string' || !address.trim()) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }
    if (!site_type || typeof site_type !== 'string') {
      return NextResponse.json({ error: 'Site type is required' }, { status: 400 });
    }

    // Validate site_type is one of allowed values
    const validTypes = ['billboard', 'screen', 'street_furniture', 'transit'];
    if (!validTypes.includes(site_type)) {
      return NextResponse.json(
        { error: `Invalid site_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 3. Generate API key
    const api_key = `oc_site_${randomUUID().replace(/-/g, '').slice(0, 32)}`;

    // 4. Insert into sites table
    const svc = createServiceClient();

    const insertData: Record<string, unknown> = {
      tenant_id,
      name: name.trim(),
      address: address.trim(),
      site_type,
      api_key,
      is_active: true,
    };

    // Optional fields
    if (body.facing) insertData.facing = body.facing;
    if (typeof body.gps_lat === 'number') insertData.gps_lat = body.gps_lat;
    if (typeof body.gps_lng === 'number') insertData.gps_lng = body.gps_lng;
    if (typeof body.screen_width_mm === 'number') insertData.screen_width_mm = body.screen_width_mm;
    if (typeof body.screen_height_mm === 'number') insertData.screen_height_mm = body.screen_height_mm;

    const { data: site, error } = await svc
      .from('sites')
      .insert(insertData)
      .select('id, name, address, site_type, created_at')
      .single();

    if (error) {
      console.error('[api/sites] insert error:', error);
      return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
    }

    // 5. Return site + api_key (shown once)
    return NextResponse.json({
      site,
      api_key,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'NO_TENANT') {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 403 });
    }
    console.error('[api/sites] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
