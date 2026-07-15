# Training a SA Plate Detection Model (YOLOv8)

This guide walks you through training a YOLOv8-nano model specifically for
South African license plate detection. A fine-tuned SA model will significantly
outperform the generic baseline model, especially in local lighting conditions
and with SA plate formats.

---

## Why Fine-Tune?

The default `yolov8n-plate.pt` model is trained on mixed datasets (CCPD, OpenALPR
datasets) which include mostly Chinese, US, and European plates. SA plates have
distinct characteristics:

- Yellow reflective background on rear plates
- Green/white gradient on newer Gauteng plates
- Varied font, spacing, and size standards
- High ambient contrast (bright Highveld sun, night glare)

A fine-tuned model typically achieves **85–95% detection mAP** on SA plates vs
**55–70%** with the generic model.

---

## Dataset Requirements

| Metric | Minimum | Recommended |
|--------|---------|-------------|
| Total images | 500 | 2 000+ |
| Plate visibility | Clearly visible | Various angles/distances |
| Lighting variation | Day only | Day + night + dusk |
| Vehicle types | Cars only | Cars + trucks + bakkies |
| Provinces | 1–2 | All 9 provinces |

### Privacy Note
Do **NOT** label or store raw plate text anywhere in the dataset.
Only plate bounding boxes are needed for detection training.
The dataset contains images with bounding boxes — no OCR labels required.

---

## Step 1: Collect Images

Collect vehicle images where plates are visible. Sources:

1. **From OmniCollect** — extract vehicle crops from RTSP recordings
2. **Manual capture** — photograph vehicles in a controlled environment
3. **Public datasets** — search Roboflow or Kaggle for SA/ZA plate datasets

Recommended split:
```
dataset/
  images/
    train/    # 80% of images
    val/      # 20% of images
  labels/
    train/    # YOLO format label files
    val/
```

---

## Step 2: Label the Images

Use [LabelImg](https://github.com/HumanSignal/labelImg) or [Roboflow](https://roboflow.com) to draw bounding boxes around license plates.

**YOLO label format** (one `.txt` file per image, same filename):

```
<class_id> <x_center> <y_center> <width> <height>
```

- All values are **normalized** (0.0–1.0) relative to image dimensions
- `class_id` = `0` (plates are class 0)
- Coordinates are the **center** of the bounding box, not top-left

**Example** for a 640×480 image with a plate at pixel (200, 300, 440, 360):
```
0 0.500 0.688 0.375 0.125
```

Computed as:
- x_center = (200 + 440) / 2 / 640 = 0.500
- y_center = (300 + 360) / 2 / 480 = 0.688
- width = (440 - 200) / 640 = 0.375
- height = (360 - 300) / 480 = 0.125

---

## Step 3: Dataset Config File

Create `scripts/train/plates.yaml`:

```yaml
# plates.yaml — YOLOv8 dataset config for SA plate detection

path: /path/to/your/dataset   # absolute path to dataset root
train: images/train
val: images/val

# Number of classes
nc: 1

# Class names
names:
  0: plate
```

A sample `plates.yaml` is included in this directory.

---

## Step 4: Train

```bash
# Install ultralytics (if not already done)
pip install ultralytics

# Train YOLOv8-nano on your SA plate dataset
yolo train \
  model=yolov8n.pt \
  data=scripts/train/plates.yaml \
  epochs=100 \
  imgsz=640 \
  batch=16 \
  name=sa-plates \
  project=runs/train \
  patience=20
```

**On Jetson Orin Nano** (training directly on device — slower but possible):
```bash
yolo train model=yolov8n.pt data=plates.yaml epochs=100 imgsz=640 batch=4 device=0
```

Use `batch=4` on Jetson — the 8GB RAM fills up fast with larger batches.

**Recommended: train on a GPU workstation**, then copy the `.pt` file to the Jetson.

---

## Step 5: Evaluate Accuracy

After training, evaluate on the validation set:

```bash
yolo val model=runs/train/sa-plates/weights/best.pt data=scripts/train/plates.yaml
```

Key metrics to check:

| Metric | Acceptable | Good | Excellent |
|--------|-----------|------|-----------|
| mAP50 | > 0.70 | > 0.85 | > 0.93 |
| mAP50-95 | > 0.45 | > 0.60 | > 0.75 |
| Recall | > 0.75 | > 0.85 | > 0.92 |

If mAP50 < 0.70:
- Add more data (especially night/rain/partial occlusion cases)
- Train for more epochs (try 200)
- Try `yolov8s.pt` (small) instead of nano for better accuracy at slight speed cost

---

## Step 6: Deploy to Production

Swapping the model requires **zero code changes**:

```bash
# Copy new model to the device
scp runs/train/sa-plates/weights/best.pt user@jetson-ip:/app/models/yolov8n-plate.pt

# Restart the agent (Balena)
balena push <fleet-name>
# or on device:
docker restart omnicollect-edge
```

The agent loads the model from `config.yaml → plate.model_path` at startup.
To use a different filename, update `plate.model_path` in `config.yaml`.

---

## Appendix: plates.yaml Sample

```yaml
path: /data/sa-plates-dataset
train: images/train
val: images/val

nc: 1
names:
  0: plate
```

---

## Appendix: Augmentation Tips

For SA-specific robustness, include augmentation in training:

```python
# In your custom YOLOv8 training config (optional):
augment:
  hsv_h: 0.015     # hue shift (handles different plate colours)
  hsv_s: 0.7       # saturation (faded plates)
  hsv_v: 0.4       # brightness (night + harsh sun)
  degrees: 5.0     # slight rotation
  translate: 0.1
  shear: 2.0
  flipud: 0.0      # don't flip vertically (plates have orientation)
  fliplr: 0.5      # horizontal flip is fine
  mosaic: 1.0      # mosaic augmentation (very helpful for small datasets)
```

---

## Questions / Issues

For training questions, open an issue in the OmniCollect repo or refer to:
- [Ultralytics YOLOv8 docs](https://docs.ultralytics.com/tasks/detect/)
- [Roboflow SA plate datasets](https://universe.roboflow.com/search?q=south+africa+license+plate)
