"""
YOLO Detector Module
====================
YOLO-based object detection for cricket ball and player tracking.
"""

import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import os


@dataclass
class Detection:
    """Represents a detected object."""
    class_id: int
    class_name: str
    confidence: float
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    center: Tuple[float, float]


class YOLODetector:
    """
    YOLO-based object detector for cricket analysis.
    
    Detects:
    - Cricket ball (sports ball class or custom trained)
    - Players/batsmen
    - Cricket bat
    - Stumps/wickets
    """
    
    # COCO class IDs we're interested in
    SPORTS_BALL = 32
    PERSON = 0
    BASEBALL_BAT = 34  # Closest to cricket bat in COCO
    
    # Custom class mappings for cricket-trained model
    CUSTOM_CLASSES = {
        0: 'ball',
        1: 'batsman',
        2: 'bowler',
        3: 'bat',
        4: 'stumps',
        5: 'pad'
    }
    
    def __init__(self, model_path: Optional[str] = None, use_custom: bool = False):
        """
        Initialize YOLO detector.
        
        Args:
            model_path: Path to custom YOLO model weights
            use_custom: Whether to use custom cricket-trained model
        """
        self.model = None
        self.use_custom = use_custom
        self.model_path = model_path
        self.is_available = False
        
        self._load_model()
    
    def _load_model(self):
        """Load YOLO model."""
        try:
            from ultralytics import YOLO
            
            if self.model_path and os.path.exists(self.model_path):
                # Load custom cricket-trained model
                self.model = YOLO(self.model_path)
                self.use_custom = True
                print(f"Loaded custom YOLO model from {self.model_path}")
            else:
                # Use pre-trained YOLOv8 model
                self.model = YOLO('yolov8n.pt')  # Nano model for speed
                self.use_custom = False
                print("Loaded YOLOv8n pre-trained model")
            
            self.is_available = True
            
        except ImportError:
            print("Warning: ultralytics not installed. YOLO detection disabled.")
            self.is_available = False
        except Exception as e:
            print(f"Warning: Could not load YOLO model: {e}")
            self.is_available = False
    
    def detect(self, frame: np.ndarray, conf_threshold: float = 0.3) -> List[Detection]:
        """
        Run YOLO detection on a frame.
        
        Args:
            frame: BGR image frame
            conf_threshold: Minimum confidence threshold
            
        Returns:
            List of Detection objects
        """
        if not self.is_available or self.model is None:
            return []
        
        try:
            # Run inference
            results = self.model(frame, conf=conf_threshold, verbose=False)
            
            detections = []
            for result in results:
                boxes = result.boxes
                
                for box in boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    # Get class name
                    if self.use_custom:
                        class_name = self.CUSTOM_CLASSES.get(class_id, 'unknown')
                    else:
                        class_name = self.model.names.get(class_id, 'unknown')
                    
                    center = ((x1 + x2) / 2, (y1 + y2) / 2)
                    
                    detections.append(Detection(
                        class_id=class_id,
                        class_name=class_name,
                        confidence=confidence,
                        bbox=(x1, y1, x2, y2),
                        center=center
                    ))
            
            return detections
            
        except Exception as e:
            print(f"YOLO detection error: {e}")
            return []
    
    def detect_ball(self, frame: np.ndarray) -> Optional[Detection]:
        """
        Detect cricket ball in frame.
        
        Uses YOLO sports_ball class or custom ball class.
        """
        detections = self.detect(frame, conf_threshold=0.25)
        
        ball_detections = []
        for det in detections:
            if self.use_custom:
                if det.class_name == 'ball':
                    ball_detections.append(det)
            else:
                # Use sports ball class from COCO
                if det.class_id == self.SPORTS_BALL:
                    ball_detections.append(det)
        
        # Return highest confidence ball detection
        if ball_detections:
            return max(ball_detections, key=lambda d: d.confidence)
        
        return None
    
    def detect_players(self, frame: np.ndarray) -> List[Detection]:
        """
        Detect players (batsman, bowler) in frame.
        """
        detections = self.detect(frame, conf_threshold=0.4)
        
        player_detections = []
        for det in detections:
            if self.use_custom:
                if det.class_name in ['batsman', 'bowler']:
                    player_detections.append(det)
            else:
                if det.class_id == self.PERSON:
                    player_detections.append(det)
        
        return player_detections
    
    def detect_stumps(self, frame: np.ndarray) -> Optional[Detection]:
        """
        Detect cricket stumps/wickets.
        Only available with custom trained model.
        """
        if not self.use_custom:
            return None
        
        detections = self.detect(frame, conf_threshold=0.3)
        
        stump_detections = [d for d in detections if d.class_name == 'stumps']
        
        if stump_detections:
            return max(stump_detections, key=lambda d: d.confidence)
        
        return None
    
    def detect_bat(self, frame: np.ndarray) -> Optional[Detection]:
        """Detect cricket bat."""
        detections = self.detect(frame, conf_threshold=0.3)
        
        bat_detections = []
        for det in detections:
            if self.use_custom:
                if det.class_name == 'bat':
                    bat_detections.append(det)
            else:
                if det.class_id == self.BASEBALL_BAT:
                    bat_detections.append(det)
        
        if bat_detections:
            return max(bat_detections, key=lambda d: d.confidence)
        
        return None
    
    def detect_pads(self, frame: np.ndarray) -> List[Detection]:
        """
        Detect batting pads.
        Only available with custom trained model.
        """
        if not self.use_custom:
            return []
        
        detections = self.detect(frame, conf_threshold=0.3)
        return [d for d in detections if d.class_name == 'pad']
    
    def get_all_cricket_objects(self, frame: np.ndarray) -> Dict[str, List[Detection]]:
        """
        Detect all cricket-related objects in frame.
        
        Returns dict with keys: ball, players, bat, stumps, pads
        """
        all_detections = self.detect(frame, conf_threshold=0.25)
        
        result = {
            'ball': [],
            'players': [],
            'bat': [],
            'stumps': [],
            'pads': []
        }
        
        for det in all_detections:
            if self.use_custom:
                if det.class_name == 'ball':
                    result['ball'].append(det)
                elif det.class_name in ['batsman', 'bowler']:
                    result['players'].append(det)
                elif det.class_name == 'bat':
                    result['bat'].append(det)
                elif det.class_name == 'stumps':
                    result['stumps'].append(det)
                elif det.class_name == 'pad':
                    result['pads'].append(det)
            else:
                # COCO classes
                if det.class_id == self.SPORTS_BALL:
                    result['ball'].append(det)
                elif det.class_id == self.PERSON:
                    result['players'].append(det)
                elif det.class_id == self.BASEBALL_BAT:
                    result['bat'].append(det)
        
        return result


class BallTracker:
    """
    Multi-frame ball tracker using YOLO detections and Kalman filter.
    """
    
    def __init__(self):
        self.tracks: List[Dict] = []
        self.next_track_id = 0
        self.max_age = 10  # Frames to keep track without detection
        self.min_hits = 3  # Minimum detections to confirm track
        
        # Kalman filter parameters
        self.kalman_filters: Dict[int, cv2.KalmanFilter] = {}
    
    def _create_kalman_filter(self) -> cv2.KalmanFilter:
        """Create Kalman filter for ball tracking."""
        kf = cv2.KalmanFilter(6, 3)  # 6 state vars (x,y,z,vx,vy,vz), 3 measurements
        
        # Transition matrix (constant velocity model)
        kf.transitionMatrix = np.array([
            [1, 0, 0, 1, 0, 0],
            [0, 1, 0, 0, 1, 0],
            [0, 0, 1, 0, 0, 1],
            [0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1]
        ], dtype=np.float32)
        
        # Measurement matrix
        kf.measurementMatrix = np.array([
            [1, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0]
        ], dtype=np.float32)
        
        # Process noise
        kf.processNoiseCov = np.eye(6, dtype=np.float32) * 0.03
        
        # Measurement noise
        kf.measurementNoiseCov = np.eye(3, dtype=np.float32) * 0.1
        
        return kf
    
    def update(self, detection: Optional[Detection], frame_num: int, 
               estimated_depth: float = 0) -> Optional[Dict]:
        """
        Update tracker with new detection.
        
        Returns current ball position estimate.
        """
        if detection is None:
            # No detection - predict from existing tracks
            for track in self.tracks:
                if track['age'] < self.max_age:
                    track['age'] += 1
                    kf = self.kalman_filters.get(track['id'])
                    if kf:
                        prediction = kf.predict()
                        track['predicted'] = {
                            'x': float(prediction[0]),
                            'y': float(prediction[1]),
                            'z': float(prediction[2])
                        }
            
            # Return best active track prediction
            active_tracks = [t for t in self.tracks if t['age'] < self.max_age]
            if active_tracks:
                best = max(active_tracks, key=lambda t: t['hits'])
                return best.get('predicted')
            
            return None
        
        # Have detection - update or create track
        x, y = detection.center
        z = estimated_depth
        
        # Find matching track
        matched_track = None
        min_dist = float('inf')
        
        for track in self.tracks:
            if track['age'] >= self.max_age:
                continue
            
            last_pos = track.get('last_position', {})
            if last_pos:
                dist = np.sqrt(
                    (x - last_pos['x'])**2 + 
                    (y - last_pos['y'])**2
                )
                if dist < 100 and dist < min_dist:  # Max association distance
                    min_dist = dist
                    matched_track = track
        
        if matched_track:
            # Update existing track
            matched_track['age'] = 0
            matched_track['hits'] += 1
            matched_track['last_position'] = {'x': x, 'y': y, 'z': z}
            matched_track['positions'].append({
                'frame': frame_num,
                'x': x, 'y': y, 'z': z,
                'confidence': detection.confidence
            })
            
            # Update Kalman filter
            kf = self.kalman_filters.get(matched_track['id'])
            if kf:
                measurement = np.array([[x], [y], [z]], dtype=np.float32)
                kf.correct(measurement)
            
            return matched_track['last_position']
        
        else:
            # Create new track
            track_id = self.next_track_id
            self.next_track_id += 1
            
            new_track = {
                'id': track_id,
                'age': 0,
                'hits': 1,
                'last_position': {'x': x, 'y': y, 'z': z},
                'positions': [{
                    'frame': frame_num,
                    'x': x, 'y': y, 'z': z,
                    'confidence': detection.confidence
                }]
            }
            
            # Initialize Kalman filter
            kf = self._create_kalman_filter()
            kf.statePost = np.array([[x], [y], [z], [0], [0], [0]], dtype=np.float32)
            self.kalman_filters[track_id] = kf
            
            self.tracks.append(new_track)
            
            return new_track['last_position']
    
    def get_trajectory(self) -> List[Dict]:
        """Get smoothed trajectory from best track."""
        if not self.tracks:
            return []
        
        # Find track with most hits
        best_track = max(self.tracks, key=lambda t: t['hits'])
        
        if best_track['hits'] < self.min_hits:
            return []
        
        return best_track['positions']
    
    def reset(self):
        """Reset all tracks."""
        self.tracks = []
        self.kalman_filters = {}
        self.next_track_id = 0


class PlayerTracker:
    """
    Track players (batsman position) across frames.
    """
    
    def __init__(self):
        self.batsman_positions: List[Dict] = []
        self.bowler_positions: List[Dict] = []
    
    def update(self, player_detections: List[Detection], frame_num: int):
        """
        Update player positions.
        
        Classifies players based on position in frame.
        """
        if not player_detections:
            return
        
        # Sort by x position to help classify
        sorted_players = sorted(player_detections, key=lambda d: d.center[0])
        
        for det in sorted_players:
            x, y = det.center
            bbox = det.bbox
            height = bbox[3] - bbox[1]
            
            position = {
                'frame': frame_num,
                'x': x,
                'y': y,
                'bbox': bbox,
                'height': height,
                'confidence': det.confidence
            }
            
            # Simple classification: batsman is usually on right side of frame
            # and in lower portion (closer to camera at batting end)
            frame_mid = 640  # Approximate
            
            if x > frame_mid * 0.6:
                self.batsman_positions.append(position)
            else:
                self.bowler_positions.append(position)
    
    def get_batsman_position(self, frame_num: int) -> Optional[Dict]:
        """Get batsman position at specific frame."""
        for pos in reversed(self.batsman_positions):
            if pos['frame'] == frame_num:
                return pos
        
        # Return closest earlier frame
        earlier = [p for p in self.batsman_positions if p['frame'] < frame_num]
        if earlier:
            return earlier[-1]
        
        return None
    
    def get_leg_position(self, frame_num: int) -> Optional[Dict]:
        """
        Estimate leg/pad position from batsman detection.
        
        Pads are typically in lower 40% of bounding box.
        """
        batsman = self.get_batsman_position(frame_num)
        
        if not batsman:
            return None
        
        bbox = batsman['bbox']
        x1, y1, x2, y2 = bbox
        
        # Estimate pad region (lower portion of player bbox)
        pad_top = y1 + (y2 - y1) * 0.6
        pad_center_x = (x1 + x2) / 2
        pad_center_y = (pad_top + y2) / 2
        
        return {
            'x': pad_center_x,
            'y': pad_center_y,
            'top': pad_top,
            'bottom': y2,
            'width': x2 - x1
        }
    
    def reset(self):
        """Reset all positions."""
        self.batsman_positions = []
        self.bowler_positions = []
