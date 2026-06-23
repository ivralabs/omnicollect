# OmniCollect

> The measurement layer of the Ivra Labs OOH stack.

OmniCollect is a purpose-built vehicle and audience intelligence platform for the Out-of-Home advertising industry. It turns estimated audience figures into verified, real-time data — giving media owners the proof they need to command premium rates, and agencies the numbers they can take to clients.

---

## The Problem

Every advertising medium has a measurement standard:
- TV → Nielsen
- Digital → Google Analytics, programmatic impression logs
- Radio → RAMS

**OOH has nothing.** Survey-based data, updated every 2–3 years, averaged across broad zones. A billboard on one of Johannesburg's busiest corridors gets the same audience estimate as one 2km away on a quieter road. That's guesswork, not measurement.

OmniCollect ends that.

---

## What OmniCollect Does

Connect any IP camera to OmniCollect's edge AI device and get:

- **Vehicle counting** — real-time, site-specific, continuously updated
- **Vehicle make & model detection** — Toyota Fortuner, BMW 3 Series, VW Polo, etc.
- **Vehicle colour detection**
- **Number plate hashing** — frequency and reach measurement without storing identifiable data (POPIA/GDPR compliant)
- **People counting + dwell time**
- **Demographic inference** — age range, gender (on-device, anonymised)
- **Weather correlation** — how conditions affect audience size
- **Cross-site audience journey** — verified unique reach across multiple billboard sites
- **Post-campaign reports** — auto-generated, verified numbers in 30 seconds

---

## The Stack (Ivra Labs)

| Product | Layer | Role |
|---|---|---|
| **Deckly** | Sales | Rate cards, proposals, client decks |
| **Cuecast** | Operations | Content scheduling, screen management |
| **OmniCollect** | Measurement | Audience verification, campaign proof |

OmniCollect closes the loop: Deckly promises X impressions → OmniCollect verifies actual delivery.

---

## Hardware

**Pilot:** Raspberry Pi 5 + Hailo-8L AI Hat (~R 3 500/site)
**Scale:** Orange Pi 5 Plus (~R 2 000/site)
**Production:** NVIDIA Jetson Orin Nano (~R 5 000/site)

Works with existing cameras — most DOOH screens already have one.

---

## Software Roadmap

**Phase 1 — MVP**
Vehicle counting, classification, plate hashing, basic dashboard, anomaly alerts

**Phase 2 — Intelligence**
Weather correlation, dwell time, seasonal profiling, post-campaign reports

**Phase 3 — Network**
Cross-site audience journey, creative performance scoring, OmniCollect Score (1–100), agency planning dashboard

**Phase 4 — Platform**
Programmatic OOH API, event impact tracking, predictive forecasting, data licensing

---

## Status

> Planning phase. No build timeline set. Vision and business model locked.
> Build begins after Deckly reaches first paying customers.

---

## Business Model

- **Media owner subscriptions** — R 450–R 800/site/month
- **Agency reports** — R 4 500/campaign verification report
- **Agency dashboards** — R 8 500/month planning access
- **Data licensing** — retailers, property developers, municipalities, insurers
- **Programmatic API** — 5–10% revenue share on pDOOH transactions

**Target:** R 73M ARR by Year 5 (SA + 2 African markets + programmatic API live)

---

## The Pitch

Agencies ask: *"Can you prove that?"*

OmniCollect is the yes.

---

*Part of the [Ivra Labs](https://github.com/ivralabs) OOH operating system.*
