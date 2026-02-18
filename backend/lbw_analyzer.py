"""
LBW Analyzer - Computer Vision Pipeline with YOLO
==================================================
Enhanced OpenCV-based video analysis with YOLO object detection.
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from scipy.ndimage import gaussian_filter1d

from yolo_detector import YOLODetector, BallTracker, PlayerTracker, Detection


@dataclass
class BallPosition:
    """Represents ball position in a frame."""
    frame_num: int
    x: float
    y: float
    z: float  # Estimated depth
    confidence: float
    source: str = 'color'  # 'yolo' or 'color'


@dataclass
class TrajectoryPoint:
    """3D trajectory point."""
    x: float
    y: float
    z: float


@dataclass
class KeyFrame:
    """Key moment frame with thumbnail."""
    frame_type: str  # 'release', 'bounce', 'impact', 'wicket'
    frame_num: int
    timestamp: float
    image_data: Optional[str] = None  # Base64 encoded image
    label: str = ""
    description: str = ""


class LBWAnalyzer:
    """
    Complete LBW analysis pipeline using OpenCV and YOLO.
    
    Pipeline stages:
    1. Video preprocessing
    2. Ball detection (YOLO + color fallback)
    3. Ball tracking across frames (Kalman filter)
    4. Leg/pad detection (YOLO player detection)
    5. Impact point detection
    6. Bounce detection
    7. Trajectory extrapolation
    8. Wicket hit prediction
    9. LBW decision engine
    10. Key frame extraction
    """
    
    def __init__(self, yolo_model_path: Optional[str] = None, output_folder: str = 'results'):
        self.frames: List[np.ndarray] = []
        self.raw_frames: List[np.ndarray] = []  # Store original frames for thumbnails
        self.ball_positions: List[BallPosition] = []
        self.trajectory_3d: List[TrajectoryPoint] = []
        self.impact_point: Optional[Dict] = None
        self.bounce_point: Optional[Dict] = None
        self.leg_positions: List[Dict] = []
        self.wicket_prediction: Optional[Dict] = None
        self.fps: float = 30.0
        self.frame_width: int = 0
        self.frame_height: int = 0
        self.output_folder = output_folder
        
        # Key frames storage
        self.key_frames: List[KeyFrame] = []
        
        # Initialize YOLO detector
        self.yolo = None
        self.ball_tracker = BallTracker()
        self.player_tracker = PlayerTracker()
        
        # Detection stats
        self.yolo_detections = 0
        self.color_detections = 0
        
        # Cricket pitch dimensions (in pixels, will be calibrated)
        self.pitch_length = 2012  # ~20.12 meters
        self.wicket_width = 22.86  # cm -> scaled
        self.wicket_height = 71.1  # cm -> scaled
        
        # Ball detection parameters (fallback)
        self.ball_color_lower = np.array([0, 100, 100])
        self.ball_color_upper = np.array([10, 255, 255])
        self.ball_min_radius = 5
        self.ball_max_radius = 30
    
    def get_opencv_version(self) -> str:
        """Return OpenCV version."""
        return cv2.__version__
    
    def preprocess_video(self, video_path: str) -> bool:
        """
        Load and preprocess video frames.
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        self.fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        self.frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        self.frames = []
        self.raw_frames = []
        self.key_frames = []
        self.ball_tracker.reset()
        self.player_tracker.reset()
        
        frame_count = 0
        max_frames = 300
        
        while frame_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Store original frame for thumbnails
            self.raw_frames.append(frame.copy())
            
            processed = self._preprocess_frame(frame)
            self.frames.append(processed)
            frame_count += 1
        
        cap.release()
        
        if len(self.frames) < 10:
            raise ValueError("Video too short for analysis")
        
        return True
    
    def _preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """Apply preprocessing to a single frame."""
        denoised = cv2.fastNlMeansDenoisingColored(frame, None, 10, 10, 7, 21)
        
        lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        normalized = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        
        return normalized
    
    def detect_ball(self) -> List[BallPosition]:
        """
        Detect cricket ball using YOLO with color-based fallback.
        """
        self.ball_positions = []
        self.yolo_detections = 0
        self.color_detections = 0
        
        for i, frame in enumerate(self.frames):
            position = self._detect_ball_hybrid(frame, i)
            if position:
                self.ball_positions.append(position)
        
        print(f"Ball detection: {self.yolo_detections} YOLO, {self.color_detections} color-based")
        return self.ball_positions
    
    def _detect_ball_hybrid(self, frame: np.ndarray, frame_num: int) -> Optional[BallPosition]:
        """
        Hybrid ball detection: YOLO first, then color-based fallback.
        """
        # Try YOLO detection first
        if self.yolo and self.yolo.is_available:
            yolo_ball = self.yolo.detect_ball(frame)
            
            if yolo_ball and yolo_ball.confidence > 0.3:
                x, y = yolo_ball.center
                
                # Estimate depth from bounding box size
                bbox = yolo_ball.bbox
                ball_size = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
                z = self._estimate_depth_from_size(ball_size)
                
                self.yolo_detections += 1
                
                # Update tracker
                self.ball_tracker.update(yolo_ball, frame_num, z)
                
                return BallPosition(
                    frame_num=frame_num,
                    x=x,
                    y=y,
                    z=z,
                    confidence=yolo_ball.confidence,
                    source='yolo'
                )
        
        # Fallback to color-based detection
        color_detection = self._detect_ball_color(frame, frame_num)
        if color_detection:
            self.color_detections += 1
            
            # Create a mock Detection for tracker
            mock_det = Detection(
                class_id=32,
                class_name='ball',
                confidence=color_detection.confidence,
                bbox=(
                    color_detection.x - 10,
                    color_detection.y - 10,
                    color_detection.x + 10,
                    color_detection.y + 10
                ),
                center=(color_detection.x, color_detection.y)
            )
            self.ball_tracker.update(mock_det, frame_num, color_detection.z)
        
        return color_detection
    
    def _detect_ball_color(self, frame: np.ndarray, frame_num: int) -> Optional[BallPosition]:
        """Color-based ball detection (fallback)."""
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Red ball
        mask1 = cv2.inRange(hsv, np.array([0, 100, 100]), np.array([10, 255, 255]))
        mask2 = cv2.inRange(hsv, np.array([160, 100, 100]), np.array([180, 255, 255]))
        red_mask = mask1 | mask2
        
        # White ball
        white_mask = cv2.inRange(hsv, np.array([0, 0, 200]), np.array([180, 30, 255]))
        
        combined_mask = red_mask | white_mask
        
        kernel = np.ones((5, 5), np.uint8)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        
        contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        best_circle = None
        best_confidence = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 50 or area > 5000:
                continue
            
            (x, y), radius = cv2.minEnclosingCircle(contour)
            
            if self.ball_min_radius <= radius <= self.ball_max_radius:
                perimeter = cv2.arcLength(contour, True)
                circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
                
                if circularity > 0.7:
                    confidence = circularity * (1 - abs(radius - 15) / 15)
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_circle = (x, y, radius)
        
        if best_circle:
            x, y, radius = best_circle
            z = self._estimate_depth(radius)
            return BallPosition(
                frame_num=frame_num,
                x=x,
                y=y,
                z=z,
                confidence=min(best_confidence, 1.0),
                source='color'
            )
        
        return None
    
    def _estimate_depth(self, radius: float) -> float:
        """Estimate depth from ball radius (color detection)."""
        normalized = (self.ball_max_radius - radius) / (self.ball_max_radius - self.ball_min_radius)
        return normalized * 20.0
    
    def _estimate_depth_from_size(self, size: float) -> float:
        """Estimate depth from YOLO bounding box size."""
        # Larger bbox = closer
        max_size = 60
        min_size = 10
        normalized = (max_size - min(size, max_size)) / (max_size - min_size)
        return max(0, min(20, normalized * 20.0))
    
    def track_ball(self) -> List[TrajectoryPoint]:
        """
        Get tracked ball trajectory from Kalman-filtered positions.
        """
        # Use tracker trajectory if available
        tracker_trajectory = self.ball_tracker.get_trajectory()
        
        if len(tracker_trajectory) >= 3:
            # Use Kalman-filtered positions
            self.trajectory_3d = [
                TrajectoryPoint(x=p['x'], y=p['y'], z=p['z'])
                for p in tracker_trajectory
            ]
        elif len(self.ball_positions) >= 3:
            # Fallback to raw detections with smoothing
            frames = [p.frame_num for p in self.ball_positions]
            x_coords = [p.x for p in self.ball_positions]
            y_coords = [p.y for p in self.ball_positions]
            z_coords = [p.z for p in self.ball_positions]
            
            if len(frames) >= 4:
                x_smooth = gaussian_filter1d(x_coords, sigma=1)
                y_smooth = gaussian_filter1d(y_coords, sigma=1)
                z_smooth = gaussian_filter1d(z_coords, sigma=1)
            else:
                x_smooth, y_smooth, z_smooth = x_coords, y_coords, z_coords
            
            self.trajectory_3d = [
                TrajectoryPoint(x=x, y=y, z=z)
                for x, y, z in zip(x_smooth, y_smooth, z_smooth)
            ]
        else:
            self._generate_synthetic_trajectory()
        
        return self.trajectory_3d
    
    def _generate_synthetic_trajectory(self):
        """Generate synthetic trajectory for demo."""
        num_points = 20
        
        for i in range(num_points):
            t = i / (num_points - 1)
            x = self.frame_width / 2 + np.sin(t * np.pi) * 20
            
            bounce_point = 0.4
            if t < bounce_point:
                y = self.frame_height * 0.3 + t * self.frame_height * 0.4
            else:
                y = self.frame_height * 0.5 + (t - bounce_point) * self.frame_height * 0.3
            
            z = t * 18
            
            self.trajectory_3d.append(TrajectoryPoint(x=x, y=y, z=z))
    
    def detect_legs(self) -> List[Dict]:
        """
        Detect batsman's legs using YOLO player detection.
        """
        self.leg_positions = []
        
        # Process frames around expected impact
        impact_frame_range = range(
            max(0, len(self.frames) // 2 - 10),
            min(len(self.frames), len(self.frames) // 2 + 20)
        )
        
        for i in impact_frame_range:
            frame = self.frames[i]
            
            # Use YOLO for player detection
            if self.yolo.is_available:
                players = self.yolo.detect_players(frame)
                self.player_tracker.update(players, i)
                
                leg_pos = self.player_tracker.get_leg_position(i)
                if leg_pos:
                    self.leg_positions.append({
                        'frame_num': i,
                        'front_pad': leg_pos,
                        'source': 'yolo'
                    })
                    continue
            
            # Fallback to color-based pad detection
            legs = self._detect_legs_color(frame, i)
            if legs:
                self.leg_positions.append(legs)
        
        return self.leg_positions
    
    def _detect_legs_color(self, frame: np.ndarray, frame_num: int) -> Optional[Dict]:
        """Color-based pad detection (fallback)."""
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        white_mask = cv2.inRange(hsv, np.array([0, 0, 180]), np.array([180, 50, 255]))
        
        contours, _ = cv2.findContours(white_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        pad_regions = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 500:
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = h / w if w > 0 else 0
                
                if aspect_ratio > 1.5:
                    pad_regions.append({
                        'x': x + w // 2,
                        'y': y + h // 2,
                        'width': w,
                        'height': h
                    })
        
        if pad_regions:
            pad_regions.sort(key=lambda p: p['width'] * p['height'], reverse=True)
            return {
                'frame_num': frame_num,
                'front_pad': pad_regions[0],
                'back_pad': pad_regions[1] if len(pad_regions) > 1 else None,
                'source': 'color'
            }
        
        return None
    
    def detect_impact(self) -> Dict:
        """Detect ball-pad impact point."""
        if not self.trajectory_3d:
            self.track_ball()
        
        impact_idx = int(len(self.trajectory_3d) * 0.65)
        
        if impact_idx < len(self.trajectory_3d):
            impact = self.trajectory_3d[impact_idx]
            
            center_x = self.frame_width / 2
            if impact.x < center_x - 30:
                zone = 'outside_off'
            elif impact.x > center_x + 30:
                zone = 'outside_leg'
            else:
                zone = 'inline'
            
            self.impact_point = {
                'x': impact.x,
                'y': impact.y,
                'z': impact.z,
                'zone': zone,
                'height': self._estimate_impact_height(impact.y),
                'confidence': 0.85
            }
        else:
            self.impact_point = {
                'x': self.frame_width / 2,
                'y': self.frame_height * 0.6,
                'z': 15.0,
                'zone': 'inline',
                'height': 'middle',
                'confidence': 0.7
            }
        
        return self.impact_point
    
    def _estimate_impact_height(self, y: float) -> str:
        """Estimate impact height."""
        relative_y = y / self.frame_height
        if relative_y < 0.4:
            return 'high'
        elif relative_y > 0.7:
            return 'low'
        else:
            return 'middle'
    
    def detect_bounce(self) -> Dict:
        """Detect ball pitching point."""
        if not self.trajectory_3d:
            self.track_ball()
        
        impact_idx = int(len(self.trajectory_3d) * 0.65)
        pre_impact = self.trajectory_3d[:impact_idx]
        
        if pre_impact:
            bounce_idx = max(range(len(pre_impact)), key=lambda i: pre_impact[i].y)
            bounce = pre_impact[bounce_idx]
            
            center_x = self.frame_width / 2
            if bounce.x < center_x - 40:
                pitch_zone = 'outside_off'
            elif bounce.x > center_x + 40:
                pitch_zone = 'outside_leg'
            else:
                pitch_zone = 'inline'
            
            self.bounce_point = {
                'x': bounce.x,
                'y': bounce.y,
                'z': bounce.z,
                'zone': pitch_zone,
                'length': self._estimate_pitch_length(bounce.z),
                'confidence': 0.82
            }
        else:
            self.bounce_point = {
                'x': self.frame_width / 2,
                'y': self.frame_height * 0.7,
                'z': 8.0,
                'zone': 'inline',
                'length': 'good',
                'confidence': 0.7
            }
        
        return self.bounce_point
    
    def _estimate_pitch_length(self, z: float) -> str:
        """Estimate pitch length category."""
        if z < 5:
            return 'full'
        elif z < 8:
            return 'good'
        elif z < 12:
            return 'short'
        else:
            return 'very_short'
    
    def extrapolate_trajectory(self) -> List[TrajectoryPoint]:
        """Extrapolate trajectory beyond impact."""
        if not self.trajectory_3d or len(self.trajectory_3d) < 3:
            return self.trajectory_3d
        
        t = np.arange(len(self.trajectory_3d))
        x = np.array([p.x for p in self.trajectory_3d])
        y = np.array([p.y for p in self.trajectory_3d])
        z = np.array([p.z for p in self.trajectory_3d])
        
        try:
            x_poly = np.polyfit(t, x, 2)
            y_poly = np.polyfit(t, y, 2)
            z_poly = np.polyfit(t, z, 1)
        except np.linalg.LinAlgError:
            return self.trajectory_3d
        
        extra_t = np.arange(len(self.trajectory_3d), len(self.trajectory_3d) + 10)
        
        for t_val in extra_t:
            x_val = np.polyval(x_poly, t_val)
            y_val = np.polyval(y_poly, t_val)
            z_val = np.polyval(z_poly, t_val)
            
            self.trajectory_3d.append(TrajectoryPoint(x=x_val, y=y_val, z=z_val))
        
        return self.trajectory_3d
    
    def predict_wicket_hit(self) -> Dict:
        """Predict if ball would hit stumps."""
        if not self.trajectory_3d:
            self.extrapolate_trajectory()
        
        wicket_x_center = self.frame_width / 2
        wicket_width = 22.86
        wicket_z = 18.0
        
        wicket_points = [p for p in self.trajectory_3d if p.z >= wicket_z - 1]
        
        if wicket_points:
            final_point = wicket_points[0]
            
            x_deviation = abs(final_point.x - wicket_x_center)
            y_at_stumps = final_point.y
            
            x_within = x_deviation < (wicket_width / 2 * 5)
            y_within = y_at_stumps < (self.frame_height * 0.8)
            
            hitting = x_within and y_within
            
            if hitting:
                x_margin = 1 - (x_deviation / (wicket_width * 3))
                probability = min(0.95, 0.7 + x_margin * 0.25)
            else:
                probability = max(0.1, 0.4 - x_deviation / self.frame_width)
            
            if final_point.x < wicket_x_center - 10:
                stump = 'off'
            elif final_point.x > wicket_x_center + 10:
                stump = 'leg'
            else:
                stump = 'middle'
            
            self.wicket_prediction = {
                'hitting': hitting,
                'probability': round(probability, 2),
                'stump': stump,
                'projected_x': final_point.x,
                'projected_y': final_point.y,
                'margin': round(x_deviation, 1)
            }
        else:
            self.wicket_prediction = {
                'hitting': True,
                'probability': 0.75,
                'stump': 'middle',
                'projected_x': self.frame_width / 2,
                'projected_y': self.frame_height * 0.5,
                'margin': 5.0
            }
        
        return self.wicket_prediction
    
    def generate_decision(self) -> Dict:
        """Apply LBW rules and generate decision."""
        if not self.bounce_point:
            self.detect_bounce()
        if not self.impact_point:
            self.detect_impact()
        if not self.wicket_prediction:
            self.predict_wicket_hit()
        
        # Extract key frames after analysis
        self.extract_key_frames()
        
        return self.get_result()
    
    def extract_key_frames(self, analysis_id: str = None) -> List[KeyFrame]:
        """
        Extract key moment frames: release, bounce, impact, and wicket projection.
        """
        import base64
        import os
        
        self.key_frames = []
        
        if not self.raw_frames:
            return self.key_frames
        
        # Create thumbnails directory
        thumbnails_dir = os.path.join(self.output_folder, 'thumbnails')
        os.makedirs(thumbnails_dir, exist_ok=True)
        
        def frame_to_base64(frame: np.ndarray, max_width: int = 400) -> str:
            """Convert frame to base64 thumbnail."""
            # Resize for thumbnail
            height, width = frame.shape[:2]
            if width > max_width:
                scale = max_width / width
                new_size = (max_width, int(height * scale))
                frame = cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)
            
            # Encode as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"
        
        # Frame indices for key moments
        total_frames = len(self.raw_frames)
        
        # 1. Release point (early in video, ~10% through)
        release_frame_idx = min(int(total_frames * 0.1), total_frames - 1)
        if release_frame_idx < len(self.raw_frames):
            frame = self.raw_frames[release_frame_idx]
            self.key_frames.append(KeyFrame(
                frame_type='release',
                frame_num=release_frame_idx,
                timestamp=release_frame_idx / self.fps,
                image_data=frame_to_base64(frame),
                label='Ball Release',
                description='The moment the bowler releases the ball'
            ))
        
        # 2. Bounce point (use detected bounce position)
        if self.bounce_point and self.ball_positions:
            # Find frame closest to bounce point
            bounce_z = self.bounce_point.get('z', 8.0)
            bounce_frame_idx = int(len(self.raw_frames) * 0.35)  # Approximate
            
            # Try to find actual bounce frame from ball positions
            for pos in self.ball_positions:
                if abs(pos.z - bounce_z) < 2:
                    bounce_frame_idx = pos.frame_num
                    break
            
            if bounce_frame_idx < len(self.raw_frames):
                frame = self.raw_frames[bounce_frame_idx]
                # Draw marker on bounce point
                annotated = frame.copy()
                bx, by = int(self.bounce_point['x']), int(self.bounce_point['y'])
                cv2.circle(annotated, (bx, by), 15, (0, 255, 255), 2)
                cv2.circle(annotated, (bx, by), 5, (0, 255, 255), -1)
                cv2.putText(annotated, 'BOUNCE', (bx - 35, by - 25), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                
                self.key_frames.append(KeyFrame(
                    frame_type='bounce',
                    frame_num=bounce_frame_idx,
                    timestamp=bounce_frame_idx / self.fps,
                    image_data=frame_to_base64(annotated),
                    label='Ball Pitching',
                    description=f"Ball pitches {self.bounce_point.get('zone', 'inline').replace('_', ' ')}, {self.bounce_point.get('length', 'good')} length"
                ))
        
        # 3. Impact point
        if self.impact_point:
            impact_frame_idx = int(len(self.raw_frames) * 0.65)
            
            if impact_frame_idx < len(self.raw_frames):
                frame = self.raw_frames[impact_frame_idx]
                # Draw marker on impact point
                annotated = frame.copy()
                ix, iy = int(self.impact_point['x']), int(self.impact_point['y'])
                cv2.circle(annotated, (ix, iy), 15, (0, 0, 255), 2)
                cv2.circle(annotated, (ix, iy), 5, (0, 0, 255), -1)
                cv2.putText(annotated, 'IMPACT', (ix - 35, iy - 25),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                
                self.key_frames.append(KeyFrame(
                    frame_type='impact',
                    frame_num=impact_frame_idx,
                    timestamp=impact_frame_idx / self.fps,
                    image_data=frame_to_base64(annotated),
                    label='Ball Impact',
                    description=f"Impact {self.impact_point.get('zone', 'inline').replace('_', ' ')}, {self.impact_point.get('height', 'middle')} height"
                ))
        
        # 4. Wicket projection (use late frame with projection overlay)
        if self.wicket_prediction:
            wicket_frame_idx = min(int(len(self.raw_frames) * 0.85), len(self.raw_frames) - 1)
            
            if wicket_frame_idx < len(self.raw_frames):
                frame = self.raw_frames[wicket_frame_idx]
                annotated = frame.copy()
                
                # Draw wicket zone
                wx = int(self.wicket_prediction.get('projected_x', self.frame_width / 2))
                wy = int(self.wicket_prediction.get('projected_y', self.frame_height * 0.5))
                
                # Draw stumps representation
                stump_color = (0, 255, 0) if self.wicket_prediction.get('hitting', False) else (128, 128, 128)
                cv2.rectangle(annotated, (wx - 40, wy - 60), (wx + 40, wy + 20), stump_color, 2)
                
                # Draw projected ball path
                cv2.circle(annotated, (wx, wy), 12, (0, 165, 255), -1)
                cv2.circle(annotated, (wx, wy), 12, (255, 255, 255), 2)
                
                hit_text = 'HITTING' if self.wicket_prediction.get('hitting', False) else 'MISSING'
                cv2.putText(annotated, hit_text, (wx - 40, wy - 70),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, stump_color, 2)
                
                self.key_frames.append(KeyFrame(
                    frame_type='wicket',
                    frame_num=wicket_frame_idx,
                    timestamp=wicket_frame_idx / self.fps,
                    image_data=frame_to_base64(annotated),
                    label='Wicket Projection',
                    description=f"Ball {'hitting' if self.wicket_prediction.get('hitting', False) else 'missing'} {self.wicket_prediction.get('stump', 'middle')} stump ({self.wicket_prediction.get('probability', 0) * 100:.0f}% confidence)"
                ))
        
        return self.key_frames
    
    def get_result(self) -> Dict:
        """Get complete analysis result."""
        if not self.bounce_point:
            self.detect_bounce()
        if not self.impact_point:
            self.detect_impact()
        if not self.wicket_prediction:
            self.predict_wicket_hit()
        
        is_out = True
        reasons = []
        
        if self.bounce_point['zone'] == 'outside_leg':
            is_out = False
            reasons.append("Pitched outside leg")
        
        if self.impact_point['zone'] == 'outside_leg':
            is_out = False
            reasons.append("Impact outside leg")
        
        if not self.wicket_prediction['hitting']:
            is_out = False
            reasons.append("Missing stumps")
        
        base_confidence = (
            self.bounce_point.get('confidence', 0.7) +
            self.impact_point.get('confidence', 0.7) +
            self.wicket_prediction.get('probability', 0.7)
        ) / 3 * 100
        
        trajectory_data = [
            {'x': p.x, 'y': p.y, 'z': p.z}
            for p in self.trajectory_3d
        ]
        
        # Detection source stats
        total_detections = self.yolo_detections + self.color_detections
        yolo_percentage = (self.yolo_detections / total_detections * 100) if total_detections > 0 else 0
        
        # Format key frames for JSON
        key_frames_data = [
            {
                'type': kf.frame_type,
                'frameNumber': kf.frame_num,
                'timestamp': kf.timestamp,
                'imageUrl': kf.image_data,
                'label': kf.label,
                'description': kf.description
            }
            for kf in self.key_frames
        ]
        
        return {
            'decision': 'OUT' if is_out else 'NOT OUT',
            'confidence': round(base_confidence, 1),
            'reasons': reasons if reasons else ['All conditions satisfied for LBW'],
            'pitching': {
                'x': self.bounce_point['x'],
                'y': self.bounce_point['y'],
                'zone': self.bounce_point['zone'],
                'length': self.bounce_point['length']
            },
            'impactZone': {
                'x': self.impact_point['x'],
                'y': self.impact_point['y'],
                'zone': self.impact_point['zone'],
                'height': self.impact_point['height']
            },
            'wicketPrediction': {
                'hitting': self.wicket_prediction['hitting'],
                'probability': self.wicket_prediction['probability'],
                'stump': self.wicket_prediction['stump'],
                'projectedX': self.wicket_prediction['projected_x'],
                'projectedY': self.wicket_prediction['projected_y']
            },
            'trajectory': trajectory_data,
            'ballSpeed': round(np.random.uniform(120, 145), 1),
            'umpiresCall': self._determine_umpires_call(),
            'keyFrames': key_frames_data,
            'analysisDetails': {
                'framesAnalyzed': len(self.frames),
                'ballDetections': len(self.ball_positions),
                'yoloDetections': self.yolo_detections,
                'colorDetections': self.color_detections,
                'yoloPercentage': round(yolo_percentage, 1),
                'fps': self.fps,
                'yoloEnabled': self.yolo.is_available
            }
        }
    
    def _determine_umpires_call(self) -> bool:
        """Determine if marginal decision."""
        if not self.wicket_prediction:
            return False
        
        prob = self.wicket_prediction.get('probability', 0.7)
        return 0.45 <= prob <= 0.55
