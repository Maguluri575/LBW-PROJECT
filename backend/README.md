# LBW Decision Support System - Backend

AI-powered Leg Before Wicket analysis using OpenCV, YOLO, and Flask.

## Features

- **YOLO Object Detection** - Accurate ball and player tracking using YOLOv8
- **Hybrid Detection** - Falls back to color-based detection when YOLO misses
- **Kalman Filter Tracking** - Smooth trajectory estimation across frames
- **Player Tracking** - Detects batsman position for leg/pad location

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Server

```bash
python app.py
```

Server starts at `http://localhost:5000`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Upload video for LBW analysis (SSE stream) |
| `/api/result/<id>` | GET | Get specific analysis result |
| `/api/result/<id>` | DELETE | Delete analysis |
| `/api/history` | GET | Get all analysis history |
| `/api/stats` | GET | Dashboard statistics |
| `/api/metrics` | GET | Detailed metrics data |
| `/api/health` | GET | Health check |

## Analysis Pipeline

1. **Preprocessing** - Frame extraction, noise reduction, lighting normalization
2. **Ball Detection** - YOLO detection with color-based fallback
3. **Ball Tracking** - Kalman filter smoothing, gap interpolation
4. **Player Detection** - YOLO-based batsman/bowler detection
5. **Leg Detection** - Pad position from player bounding boxes
6. **Impact Detection** - Ball-pad contact point
7. **Bounce Detection** - Pitch location analysis
8. **Trajectory Extrapolation** - Physics-based path prediction
9. **Wicket Prediction** - Stump intersection calculation
10. **LBW Decision** - Rule engine with confidence scoring

## Custom YOLO Model

For best results, train a custom YOLO model on cricket data:

```python
from ultralytics import YOLO

# Train custom model
model = YOLO('yolov8n.pt')
model.train(data='cricket_dataset.yaml', epochs=100)

# Use in analyzer
analyzer = LBWAnalyzer(yolo_model_path='runs/detect/train/weights/best.pt')
```

### Custom Classes

When training, use these class labels:
- `ball` - Cricket ball
- `batsman` - Batsman player
- `bowler` - Bowler
- `bat` - Cricket bat
- `stumps` - Wickets/stumps
- `pad` - Batting pads

## Connecting Frontend

In your React app, set environment variables:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_USE_MOCK_API=false
```

## Folder Structure

```
backend/
├── app.py              # Flask application & routes
├── lbw_analyzer.py     # OpenCV + YOLO analysis pipeline
├── yolo_detector.py    # YOLO detection & tracking
├── storage.py          # Result persistence
├── requirements.txt    # Python dependencies
├── uploads/            # Uploaded videos (auto-created)
└── results/            # Analysis results (auto-created)
```

## Supported Video Formats

- MP4, AVI, MOV, MKV, WebM
- Max file size: 500MB
- Recommended: 720p or 1080p, 30+ FPS

## Detection Statistics

The analysis result includes detection stats:
- `yoloDetections` - Frames where YOLO detected the ball
- `colorDetections` - Frames using color-based fallback
- `yoloPercentage` - Percentage of YOLO detections
- `yoloEnabled` - Whether YOLO is available
