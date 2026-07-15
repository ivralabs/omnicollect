-- ============================================================
-- OmniCollect v1 Schema
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS — Media owner accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  onboarding_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- TENANT_USERS — Maps Supabase auth users to tenants
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member', -- owner | admin | member
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- ============================================================
-- SITES — Registered billboard/screen locations
-- ============================================================
CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  gps_lat decimal,
  gps_lng decimal,
  site_type text NOT NULL DEFAULT 'billboard', -- billboard | screen | street_furniture
  screen_width_mm int,
  screen_height_mm int,
  facing text, -- N | S | E | W
  omnicollect_score int NOT NULL DEFAULT 0, -- 1-100, recomputed after each reading
  device_id text, -- edge device identifier (Balena device UUID)
  api_key text UNIQUE DEFAULT gen_random_uuid()::text, -- site-specific ingest key
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SITE_READINGS — 15-minute aggregated readings from edge devices
-- ============================================================
CREATE TABLE IF NOT EXISTS site_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  vehicle_count int NOT NULL DEFAULT 0,
  people_count int NOT NULL DEFAULT 0,
  vehicle_classes jsonb NOT NULL DEFAULT '{}', -- {car: 12, truck: 3, motorcycle: 1, bus: 0}
  colour_breakdown jsonb NOT NULL DEFAULT '{}', -- {silver: 9, white: 7, black: 4}
  unique_plate_hashes int NOT NULL DEFAULT 0,  -- deduplicated count (hashed, not raw)
  avg_dwell_secs decimal NOT NULL DEFAULT 0,
  weather_condition text,
  temp_celsius decimal,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_readings_site_id_window_start_idx
  ON site_readings(site_id, window_start DESC);

CREATE INDEX IF NOT EXISTS site_readings_window_start_idx
  ON site_readings(window_start DESC);

-- ============================================================
-- PLATE_SIGHTINGS — Hashed plate sightings for cross-site journey (Phase 3)
-- Collected now so we have data when Phase 3 is built.
-- POPIA compliant: SHA-256 only, never raw plate text.
-- ============================================================
CREATE TABLE IF NOT EXISTS plate_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_hash text NOT NULL,  -- SHA-256 only
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL,
  vehicle_class text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plate_sightings_hash_seen_at_idx
  ON plate_sightings(plate_hash, seen_at DESC);

CREATE INDEX IF NOT EXISTS plate_sightings_site_id_seen_at_idx
  ON plate_sightings(site_id, seen_at DESC);

-- ============================================================
-- CAMPAIGNS — Media campaigns overlaid on site data
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  site_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active', -- active | completed | draft
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- SITE_ALERTS — Anomaly alerts generated by ingest API
-- ============================================================
CREATE TABLE IF NOT EXISTS site_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  alert_type text NOT NULL, -- traffic_drop | camera_offline | traffic_spike
  severity text NOT NULL DEFAULT 'warning', -- info | warning | critical
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS site_alerts_site_id_triggered_at_idx
  ON site_alerts(site_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS site_alerts_resolved_at_idx
  ON site_alerts(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plate_sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_alerts ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's tenant_id
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM tenant_users
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- tenants: user can only see their own tenant
CREATE POLICY "tenant_select" ON tenants
  FOR SELECT USING (id = auth_tenant_id());

-- tenant_users: user can see members of their tenant
CREATE POLICY "tenant_users_select" ON tenant_users
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- sites: user can only see sites belonging to their tenant
CREATE POLICY "sites_select" ON sites
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "sites_insert" ON sites
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "sites_update" ON sites
  FOR UPDATE USING (tenant_id = auth_tenant_id());

CREATE POLICY "sites_delete" ON sites
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- site_readings: via site's tenant
CREATE POLICY "site_readings_select" ON site_readings
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE tenant_id = auth_tenant_id())
  );

-- plate_sightings: via site's tenant
CREATE POLICY "plate_sightings_select" ON plate_sightings
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE tenant_id = auth_tenant_id())
  );

-- campaigns: tenant-scoped
CREATE POLICY "campaigns_select" ON campaigns
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "campaigns_insert" ON campaigns
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "campaigns_update" ON campaigns
  FOR UPDATE USING (tenant_id = auth_tenant_id());

CREATE POLICY "campaigns_delete" ON campaigns
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- site_alerts: via site's tenant
CREATE POLICY "site_alerts_select" ON site_alerts
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE tenant_id = auth_tenant_id())
  );
