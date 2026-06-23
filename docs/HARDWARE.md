# OmniCollect Hardware Spec

*Locked 2026-06-23*

## Edge AI Device Options

| Device | Cost | TOPS | Best For |
|---|---|---|---|
| Raspberry Pi 5 + Hailo-8L Hat | R 3 200 | 26 | Pilots + early deployments |
| Orange Pi 5 Plus | R 2 000 | 6 (built-in NPU) | Cost-sensitive scale (50+ sites) |
| NVIDIA Jetson Orin Nano | R 5 000 | 40 | Production / enterprise deployments |

**Recommended start:** Raspberry Pi 5 + Hailo-8L Hat — locally available (PiShop.co.za, Communica), easy to replace, proven community support.

## Total Cost Per Site (Pilot)

| Component | Cost |
|---|---|
| Raspberry Pi 5 + Hailo-8L Hat | R 3 200 |
| Weatherproof enclosure | R 400 |
| Power supply + cables | R 200 |
| Installation (1 hour) | R 500 |
| **Total** | **R 4 300** |

Break-even: Month 5–6 at R 800/site/month subscription.

## Software Stack on Device

- **Vehicle detection:** YOLOv8 (Ultralytics) — open source, COCO-pretrained
- **Make/model classification:** Fine-tuned on SA vehicle dataset (2–3 week ML task)
- **Colour detection:** OpenCV HSV classification
- **Plate OCR:** Plate Recognizer API ($0.002/plate) for pilots → OpenALPR self-hosted at scale
- **Privacy:** Plate hashed on-device (SHA-256) → raw text discarded → only hash to cloud
- **Data pipeline:** Aggregated every 15 min → HTTPS → ~1MB/day/site
- **Device management:** Balena Cloud for remote OTA updates

## Connectivity

1. **Piggyback on media owner's existing network** (preferred — most DOOH screens have connectivity)
2. **LTE SIM card** — R 50–100/month, 1MB/day payload fits cheapest plan
3. **Starlink** — only for rural sites with no LTE

## Key Question to Ask Every Media Owner

> "Does your screen already have a camera?"

Many modern DOOH screens (Samsung, LG, BrightSign, Broadsign hardware) have front-facing cameras that nobody uses. Tapping the RTSP stream = no new camera needed. Drops hardware cost to ~R 3 800/site.
