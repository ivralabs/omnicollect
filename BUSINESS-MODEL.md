# OmniCollect — Business Model & Pricing

**Status:** Planning (not building yet)
**Last updated:** 2026-04-18

---

## Revenue Model

### 1. Once-Off Setup Fee (per billboard)
Charged at installation. Covers hardware + labour.

| Item | Detail |
|---|---|
| IP Camera (weatherproof) | Outdoor-rated, supports RTSP stream |
| Mini PC | Runs local AI agent — YOLOv8, ANPR, brand recognition |
| Installation & configuration | On-site setup, network config, stream testing |
| **Suggested charge** | **R3,000–R8,000 per site** (cost + margin, varies by camera spec + location) |

Notes:
- Hardware is procured by Ivra Labs / OmniCollect and sold to the media owner
- One-time charge — no recurring hardware fee
- Installation includes commissioning the local agent and confirming data is flowing

---

### 2. Monthly Subscription (per billboard)
Recurring SaaS revenue. Charged per active billboard, not per account.

| Plan | Price | Includes |
|---|---|---|
| Per billboard | R150–R300/month | Platform access, real-time dashboard, OMC-compatible reports (VAC, Reach, GRP, CPT), data exports, health monitoring |

**Why per-billboard pricing:**
- Scales with the media owner's estate — they grow, revenue grows
- No per-account limit — a company with 1 billboard pays R150–R300; a company with 50 pays R7,500–R15,000
- AI inference runs locally (YOLOv8 on the mini PC) — zero cloud inference cost per billboard added

**Competitive context:**
- Camlytics charges ~R1,500/month per *account* (not per billboard)
- OmniCollect at R200/billboard: a 10-billboard estate = R2,000/month — more data, per-site granularity, SA-specific ANPR, brand recognition
- First customer: Box Board Advertising, Gqeberha (Mlu's company) — replaces $102/month Camlytics bill

---

## Hardware Inventory Requirements (Platform)

The OmniCollect platform needs to track hardware per installation:

### Per Billboard Record
- Billboard ID (internal)
- Media owner (company)
- Physical location (GPS coords + address)
- Camera make/model + serial number
- Mini PC make/model + serial number
- Install date
- Installation status: `surveyed` → `hardware_ordered` → `installed` → `active` → `inactive`
- Last data received (heartbeat from local agent)
- Subscription status: `active` / `suspended` / `cancelled`
- Monthly rate (in case pricing varies per client)

### Health Monitoring
- Is the mini PC online? (agent pings platform every N minutes)
- Is the camera stream live?
- Last vehicle count received
- Alert if no data received in >1 hour

---

## Internal Control Dashboard (Ops View)

OmniCollect needs its own internal control dashboard (similar to EWARP's `/control`) for Ivra Labs to manage:

- All media owners + their billboard estates
- Hardware inventory per billboard
- Installation pipeline (surveyed → active)
- Billing: setup invoices + monthly subscription status per billboard
- Health alerts: offline cameras, agent failures
- Revenue overview: MRR, total active billboards, churn

---

## Unit Economics (illustrative)

| Scenario | Active Billboards | MRR |
|---|---|---|
| MVP (Box Board only) | 5 | R750–R1,500/month |
| 5 media owners, 10 billboards each | 50 | R7,500–R15,000/month |
| 20 media owners, 15 billboards each | 300 | R45,000–R90,000/month |

Hardware margin (once-off) adds to this on top of subscription ARR.

---

## Notes for PRD (when Nova writes it)

- Billing is per billboard (not per company account)
- Platform must support: add billboard, deactivate billboard, suspend billing
- Hardware serial numbers must be recorded and linked to billboard
- Agent heartbeat system needed (mini PC phones home every X minutes)
- Health dashboard = critical for ops — media owners will call if their data stops
- Stripe for subscription billing (per-seat = per-billboard model)
- Setup invoices can be manual (PDF) for MVP → automate later
