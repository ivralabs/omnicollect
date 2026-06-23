# OmniCollect Build Plan

*Written 2026-06-24 — efficient path from zero to MVP*

## The Two Codebases

OmniCollect is two separate systems that communicate:

1. **Edge Agent** (`edge/`) — Python, runs on the Raspberry Pi / Jetson at each site
2. **Cloud Platform** (`platform/`) — Next.js + Supabase, same stack as rest of Ivra Labs

Keep them in the same repo. Different deployment targets.

---

## Codebase Structure

```
omnicollect/
├── edge/                    # Runs on Pi/Jetson per site
│   ├── detector/            # YOLOv8 vehicle detection
│   ├── classifier/          # Make/model + colour classification
│   ├── plate/               # Plate OCR + on-device hashing
│   ├── pipeline/            # Aggregation + HTTPS upload to cloud
│   ├── config.yaml          # Site ID, camera RTSP URL, API endpoint
│   └── main.py              # Entry point
│
├── platform/                # Cloud dashboard (Next.js + Supabase)
│   ├── app/                 # Next.js App Router
│   ├── lib/                 # Supabase helpers, auth, types
│   ├── supabase/            # Schema migrations
│   └── components/          # UI components
│
├── docs/                    # All planning docs
└── README.md
```

---

## Edge Agent — What It Does

```
Camera RTSP stream
       ↓
  Frame capture (every 500ms)
       ↓
  YOLOv8 detection → bounding boxes for vehicles + people
       ↓
  Classification → make/model, colour, vehicle class
       ↓
  Plate OCR → read plate text → SHA-256 hash → discard raw text
       ↓
  Aggregator → count by class, dwell time, unique hashes per 15min window
       ↓
  HTTPS POST to cloud API → tiny JSON payload (~1KB per upload)
```

**Key design decisions:**
- Process every 500ms, not every frame — reduces CPU load by 20×
- Aggregate on-device, send summary not raw detections — keeps bandwidth at ~1MB/day
- Plate hash never leaves device in raw form — POPIA compliant by design
- Config-driven — site ID, camera URL, API endpoint all in `config.yaml`, no code change per deployment
- Balena Cloud for OTA updates — push new model weights or bug fixes to all devices remotely

---

## Cloud Platform — What It Does

**Supabase schema (Phase 1):**

```sql
-- Sites registered on the platform
sites (
  id uuid PRIMARY KEY,
  tenant_id uuid,           -- media owner account
  name text,
  address text,
  gps_lat decimal,
  gps_lng decimal,
  site_type text,           -- billboard, screen, street_furniture
  omnicollect_score int,    -- 1-100, computed
  created_at timestamptz
)

-- Raw 15-minute aggregated readings from edge devices
site_readings (
  id uuid PRIMARY KEY,
  site_id uuid REFERENCES sites,
  window_start timestamptz,  -- 15-min window start
  vehicle_count int,
  people_count int,
  vehicle_classes jsonb,     -- {suv: 12, sedan: 8, bakkie: 3, ...}
  colour_breakdown jsonb,    -- {silver: 9, white: 7, black: 4, ...}
  unique_plate_hashes int,   -- deduplicated count
  avg_dwell_secs decimal,
  weather_condition text,    -- pulled from OpenWeatherMap at upload time
  temp_celsius decimal
)

-- Hashed plates for cross-site journey (Phase 3)
plate_sightings (
  id uuid PRIMARY KEY,
  plate_hash text,           -- SHA-256, never raw plate
  site_id uuid,
  seen_at timestamptz,
  vehicle_class text
)

-- Campaigns overlaid on site data
campaigns (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  name text,
  start_date date,
  end_date date,
  site_ids uuid[],
  created_at timestamptz
)

-- Alerts
site_alerts (
  id uuid PRIMARY KEY,
  site_id uuid,
  alert_type text,           -- traffic_drop, camera_offline, traffic_spike
  triggered_at timestamptz,
  resolved_at timestamptz,
  details jsonb
)
```

**Next.js pages (Phase 1 dashboard):**
```
/dashboard              — overview, all sites, network summary
/sites                  — site list with OmniCollect Score
/sites/[id]             — single site: hourly chart, vehicle class breakdown, alerts
/campaigns              — campaign list
/campaigns/[id]         — campaign report (impressions, reach, vehicle class, peak times)
/alerts                 — active anomaly alerts
/settings               — account, API keys, device management
```

**API routes:**
```
POST /api/ingest        — receives 15-min aggregated reading from edge device (authenticated by site API key)
GET  /api/sites         — list sites for tenant
GET  /api/sites/[id]/stats — time-series data for a site
POST /api/campaigns/[id]/report — generate post-campaign report
```

---

## Phase 1 Build Sequence (6 weeks, focused)

### Week 1 — Edge Agent foundation
- Set up Python project with YOLOv8 + OpenCV
- Connect to RTSP camera stream
- Vehicle detection working on a test video
- Basic counting + class breakdown outputting to console

### Week 2 — Classification + Plate
- Colour detection (HSV, reliable for common SA vehicle colours)
- Plate Recognizer API integration
- On-device plate hashing (SHA-256, raw text never stored)
- Aggregation logic (15-min windows)

### Week 3 — Cloud ingest API
- Supabase schema deployed
- `/api/ingest` endpoint — receives aggregated reading, validates API key, writes to DB
- Edge agent HTTPS upload working end-to-end
- Balena Cloud project set up for OTA

### Week 4 — Dashboard MVP
- Next.js project scaffolded (same stack as Deckly)
- Auth (Supabase, same pattern)
- Sites list page
- Single site page with hourly vehicle count chart (Recharts)

### Week 5 — Alerts + Reports
- Anomaly detection logic (traffic drops 50%+ below 7-day average = alert)
- Camera offline detection (no reading for >30 min = alert)
- Basic post-campaign report (impressions, peak times, vehicle class breakdown)
- PDF export (CloudConvert, same pattern as Deckly)

### Week 6 — Pilot prep
- End-to-end test on a real camera (even a webcam pointed at a street)
- Balena Cloud OTA update test
- Pilot media owner onboarding flow
- Documentation for IT handover

---

## Tech Stack Decisions

| Component | Choice | Why |
|---|---|---|
| Edge language | Python 3.11 | YOLOv8 native, huge ML ecosystem |
| Vehicle detection | YOLOv8 (Ultralytics) | Best speed/accuracy balance, runs on Hailo |
| Plate OCR | Plate Recognizer API | SA plates supported, $0.002/plate, no setup |
| Device management | Balena Cloud | Push updates to all devices remotely, free tier covers pilot |
| Cloud DB | Supabase | Same as all Ivra Labs products, RLS built-in |
| Cloud framework | Next.js 15 App Router | Same as Deckly, reuse patterns + components |
| Charts | Recharts | Same as Deckly dashboard |
| PDF reports | CloudConvert | Same as Deckly, proven pattern |
| Weather | OpenWeatherMap API | Free tier covers 1M calls/month |
| Auth | Supabase Auth | Same pattern as all products |
| Deployment | Vercel (platform) + Balena (edge) | Known, working |

**Rule:** Reuse every pattern from Deckly. Same auth, same Supabase client helpers, same component patterns, same PDF export. OmniCollect is a new product but not a new stack.

---

## What Can Be Reused From Deckly

| Deckly | OmniCollect equivalent |
|---|---|
| `lib/supabase/server.ts` | Copy directly |
| `lib/supabase/client.ts` | Copy directly |
| `lib/supabase/service.ts` | Copy directly |
| `lib/auth.ts` (requireTenant) | Copy directly |
| `lib/pdf.ts` (CloudConvert) | Copy for report generation |
| `components/dashboard/Sidebar.tsx` | New sidebar, same pattern |
| `app/layout.tsx` | Same structure |
| Recharts dashboard components | Same pattern |
| Vercel deployment config | Same |

**Estimate: 30–40% of boilerplate is copy-paste from Deckly.** Focus build time on the novel parts: edge agent, ingest API, anomaly detection, OmniCollect Score algorithm.

---

## The OmniCollect Score Algorithm (Phase 1 version)

Simple composite. Refine with real data over time.

```
score = (
  impressions_score    × 0.35  +   // daily impressions vs network average
  vehicle_quality      × 0.25  +   // % premium vehicle classes (SUV, luxury)
  dwell_time_score     × 0.20  +   // avg dwell vs network average
  consistency_score    × 0.15  +   // how stable/predictable the traffic is
  anomaly_penalty      × 0.05      // deduct for frequent underperformance events
)
× 100
```

Each component normalised 0–1 against network average. Score = 0–100.
Simple enough to explain to a media owner. Sophisticated enough to be defensible.

---

## The Cross-Site Journey (Phase 3 — plan ahead now)

The `plate_sightings` table is included in Phase 1 schema even though the feature isn't built until Phase 3.

**Why:** Start collecting the data from day one. By the time you build the cross-site journey feature, you'll have 12+ months of plate hash sightings to query. If you wait until Phase 3 to start collecting, you delay that feature by another 12 months.

**Privacy:** Hashes only. No raw plates. POPIA compliant. Retention policy: 90 days of raw sightings, then aggregate to monthly unique counts per site pair.

---

## Deployment Checklist (per new site)

1. Flash edge device with OmniCollect OS image (Balena)
2. Update `config.yaml` with site ID + camera RTSP URL + API key
3. Register site in OmniCollect dashboard
4. Confirm first reading appears in dashboard within 15 minutes
5. Check camera offline alert fires when device unplugged (test)
6. Hand over to media owner IT with one-page guide

Target: new site live in under 2 hours from hardware in hand.

---

## What We Don't Build Yet

- Make/model fine-tuning on SA vehicles (use generic COCO classes in Phase 1 — car/truck/motorcycle is enough to prove the model)
- Creative performance scoring (needs CMS API integration, Phase 3)
- Programmatic API (Phase 4)
- Mobile app (web dashboard is sufficient for Phase 1)
- Multi-language (English only for SA pilot)

**Rule:** Build the minimum that proves the value proposition. The value proposition is: *verified vehicle counts + vehicle class breakdown + anomaly alerts + post-campaign report.* Everything else waits until a customer asks for it.
