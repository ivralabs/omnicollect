# Ivra Labs Full Stack Vision

*Locked 2026-06-24*

## The Core Stack

Three products. One shared data layer.

```
┌─────────────────────────────────────────────────────┐
│                   IVRA LABS OOH OS                  │
├─────────────────┬──────────────────┬────────────────┤
│    DECKLY        │    CUECAST        │  OMNICOLLECT   │
│   (sell)         │   (operate)       │  (measure)     │
│                 │                  │                │
│ Rate cards      │ Content CMS      │ Vehicle intel  │
│ Proposals       │ Screen mgmt      │ Plate hashing  │
│ Client decks    │ Loop scheduling  │ Audience data  │
│ Agency briefs   │ Proof of play    │ Campaign verify│
│ Template import │ Multi-screen     │ OmniCollect    │
│ AI mapping      │ Widget system    │ Score          │
└─────────────────┴──────────────────┴────────────────┘
              ↓              ↓              ↓
┌─────────────────────────────────────────────────────┐
│              SHARED DATA LAYER                      │
│         Supabase (per-tenant, RLS)                  │
│   Sites · Screens · Campaigns · Audience ·          │
│   Inventory · Rates · Impressions · Plates          │
└─────────────────────────────────────────────────────┘
```

One site record. Three lenses. The shared data model is the moat.

---

## What Gets Built On Top

### Layer 2 — Operational Extensions

**Landlord Portal** *(6 months)*
Lease agreements, revenue share calculations, automated landlord statements, renewal reminders, performance reports. Add-on to Deckly at R 500–800/month. Currently managed by spreadsheets. Easy win.

**OOH Creative Studio** *(Year 2)*
AI-generated billboard creative, auto-sized to exact site dimensions from Deckly. Client approves in platform. Hands off to Cuecast for scheduling. R 2 000/month or R 150–300/creative. Targets media owners without in-house designers.

### Layer 3 — Marketplace & Automation

**OOH Exchange** *(Year 3–4)*
Transactional marketplace. Agencies post briefs. Media owners respond with OmniCollect-verified proposals. Booking and payment inside the platform. 3–5% transaction fee. The Airbnb of OOH inventory. At R 500M/year SA OOH spend = R 15–25M/year in fees.

**Programmatic Desk (pDOOH)** *(Year 3)*
Audience-triggered automated buying. OmniCollect detects trigger (50+ vehicles/min, temp >28°C, 30%+ SUV class) → Cuecast fires content automatically → brand pays per verified impression. The $12B global pDOOH market. Nobody owns the African layer.

### Layer 4 — Data Monetisation

**Audience Segments API** *(Year 3–4)*
Named mobility segments from OmniCollect data, sold to non-OOH buyers:
- "Luxury SUV commuters — Sandton corridor — 07:00–09:00"
- "Bakkie owners — East Rand industrial — weekday mornings"
- "School run parents — Sandton/Fourways — 07:00 and 14:30"

Sold to digital advertisers, retailers, banks, property funds. OOH data informing digital targeting. Two industries converging.

**OOH Finance Layer** *(Year 4)*
Invoice financing backed by OmniCollect-verified campaign data. Media owner gets paid in 24 hours. 2–4% fee collected when agency pays (60–90 days). The data makes credit decisions trivially easy — no traditional lender has it. FSCA regulated. Needs legal prep.

**Training & Certification** *(Year 3)*
LMS: OOH Sales Fundamentals, Deckly training, agency planner certification co-branded with OAASA. Own the industry's next generation of planners.

---

## Full Revenue Stack (Year 5)

| Product | ARR |
|---|---|
| Deckly | R 35M |
| Cuecast | R 28M |
| OmniCollect | R 73M |
| OOH Exchange | R 20M |
| Programmatic Desk | R 15M |
| Creative Studio | R 8M |
| Landlord Portal | R 4M |
| Audience Segments API | R 12M |
| Finance Layer | R 18M |
| **Total** | **R 213M ARR** |

R 100M ARR thesis target = **Year 4**.
Year 5 = **R 200M+**.

---

## The Rule

Everything above is built on Deckly's foundation.

Get Deckly right. Get the first paying customer. The rest follows.
