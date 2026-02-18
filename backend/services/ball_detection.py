from ultralytics import YOLO
import cv2

model = YOLO("yolov8n.pt")

def detect_ball(frame):
    results = model(frame)

    for r in results:
        for box in r.boxes:
            x1,y1,x2,y2 = box.xyxy[0]
            conf = box.conf[0]

            if conf > 0.5:
                return (int(x1), int(y1), int(x2), int(y2))

    return None
