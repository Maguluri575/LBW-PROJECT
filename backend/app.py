"""
LBW Decision Support System - Flask Backend
============================================
A complete backend for AI-based Leg Before Wicket analysis using OpenCV.

Run with: python app.py
API will be available at http://localhost:5000
"""

import os
import uuid
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename

from lbw_analyzer import LBWAnalyzer
from storage import AnalysisStorage

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB max

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Initialize storage and analyzer
storage = AnalysisStorage(RESULTS_FOLDER)
analyzer = LBWAnalyzer()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_analysis_events(analysis_id, video_path, file_hash):
    """Generator for SSE events during analysis"""
    steps = [
        ("preprocessing", "Preprocessing video frames..."),
        ("ball_detection", "Detecting ball in frames..."),
        ("ball_tracking", "Tracking ball trajectory..."),
        ("leg_detection", "Detecting batsman's legs..."),
        ("impact_detection", "Detecting ball-pad impact point..."),
        ("bounce_detection", "Analyzing ball bounce location..."),
        ("trajectory_extrapolation", "Extrapolating ball trajectory..."),
        ("wicket_prediction", "Predicting wicket hit probability..."),
        ("decision", "Applying LBW rules and generating decision...")
    ]
    
    try:
        # Send initial status
        yield f"data: {json.dumps({'step': 'starting', 'message': 'Starting analysis...', 'progress': 0})}\n\n"
        
        # Run actual analysis with progress callbacks
        result = None
        for i, (step_id, message) in enumerate(steps):
            progress = int((i / len(steps)) * 100)
            yield f"data: {json.dumps({'step': step_id, 'message': message, 'progress': progress})}\n\n"
            
            # Perform actual analysis step
            if step_id == "preprocessing":
                analyzer.preprocess_video(video_path)
            elif step_id == "ball_detection":
                analyzer.detect_ball()
            elif step_id == "ball_tracking":
                analyzer.track_ball()
            elif step_id == "leg_detection":
                analyzer.detect_legs()
            elif step_id == "impact_detection":
                analyzer.detect_impact()
            elif step_id == "bounce_detection":
                analyzer.detect_bounce()
            elif step_id == "trajectory_extrapolation":
                analyzer.extrapolate_trajectory()
            elif step_id == "wicket_prediction":
                analyzer.predict_wicket_hit()
            elif step_id == "decision":
                result = analyzer.generate_decision()
            
            time.sleep(0.3)  # Small delay for UI feedback
        
        # Get final result
        if result is None:
            result = analyzer.get_result()
        
        # Add metadata
        result['id'] = analysis_id
        result['videoName'] = os.path.basename(video_path)
        result['fileHash'] = file_hash
        result['timestamp'] = datetime.now().isoformat()
        result['status'] = 'completed'
        
        # Save result
        storage.save_result(analysis_id, result)
        
        # Send completion
        yield f"data: {json.dumps({'step': 'completed', 'message': 'Analysis complete!', 'progress': 100, 'result': result})}\n\n"
        
    except Exception as e:
        error_msg = str(e)
        yield f"data: {json.dumps({'step': 'error', 'message': f'Analysis failed: {error_msg}', 'error': True})}\n\n"


@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    """
    Upload and analyze a cricket video for LBW decision.
    
    Expects multipart form data with:
    - video: The video file
    - fileHash: Optional hash for deduplication
    
    Returns SSE stream with analysis progress and final result.
    """
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400
    
    file = request.files['video']
    file_hash = request.form.get('fileHash', '')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Allowed: mp4, avi, mov, mkv, webm'}), 400
    
    # Check for existing analysis with same hash
    if file_hash:
        existing = storage.find_by_hash(file_hash)
        if existing:
            return jsonify({
                'cached': True,
                'result': existing
            })
    
    # Save uploaded file
    analysis_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{analysis_id}_{filename}")
    file.save(video_path)
    
    # Return SSE stream
    return Response(
        generate_analysis_events(analysis_id, video_path, file_hash),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )


@app.route('/api/result/<analysis_id>', methods=['GET'])
def get_result(analysis_id):
    """Get the result of a specific analysis by ID."""
    result = storage.get_result(analysis_id)
    if result is None:
        return jsonify({'error': 'Analysis not found'}), 404
    return jsonify(result)


@app.route('/api/result/<analysis_id>', methods=['DELETE'])
def delete_result(analysis_id):
    """Delete an analysis result."""
    success = storage.delete_result(analysis_id)
    if not success:
        return jsonify({'error': 'Analysis not found'}), 404
    return jsonify({'success': True})


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get all analysis history, sorted by most recent first."""
    history = storage.get_all_results()
    # Sort by timestamp, most recent first
    history.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return jsonify(history)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get dashboard statistics."""
    history = storage.get_all_results()
    
    total = len(history)
    out_decisions = sum(1 for h in history if h.get('decision') == 'OUT')
    not_out_decisions = total - out_decisions
    
    # Calculate average confidence
    confidences = [h.get('confidence', 0) for h in history if 'confidence' in h]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    
    # Recent analyses (last 5)
    recent = history[:5]
    
    return jsonify({
        'totalAnalyses': total,
        'outDecisions': out_decisions,
        'notOutDecisions': not_out_decisions,
        'averageConfidence': round(avg_confidence, 1),
        'recentAnalyses': recent
    })


@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get detailed metrics for the metrics dashboard."""
    history = storage.get_all_results()
    
    # Decision distribution
    out_count = sum(1 for h in history if h.get('decision') == 'OUT')
    not_out_count = len(history) - out_count
    
    # Confidence distribution
    confidence_ranges = {'0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0}
    for h in history:
        conf = h.get('confidence', 0)
        if conf <= 25:
            confidence_ranges['0-25'] += 1
        elif conf <= 50:
            confidence_ranges['26-50'] += 1
        elif conf <= 75:
            confidence_ranges['51-75'] += 1
        else:
            confidence_ranges['76-100'] += 1
    
    # Impact zone distribution
    impact_zones = {'inline': 0, 'outside_off': 0, 'outside_leg': 0}
    for h in history:
        zone = h.get('impactZone', {}).get('zone', 'inline')
        if zone in impact_zones:
            impact_zones[zone] += 1
    
    # Pitching analysis
    pitching_data = {'inline': 0, 'outside_off': 0, 'outside_leg': 0}
    for h in history:
        pitching = h.get('pitching', {}).get('zone', 'inline')
        if pitching in pitching_data:
            pitching_data[pitching] += 1
    
    # Wicket hit predictions
    hitting_wicket = sum(1 for h in history if h.get('wicketPrediction', {}).get('hitting', False))
    missing_wicket = len(history) - hitting_wicket
    
    return jsonify({
        'decisionDistribution': {
            'out': out_count,
            'notOut': not_out_count
        },
        'confidenceDistribution': confidence_ranges,
        'impactZoneDistribution': impact_zones,
        'pitchingDistribution': pitching_data,
        'wicketPrediction': {
            'hitting': hitting_wicket,
            'missing': missing_wicket
        },
        'totalAnalyses': len(history),
        'averageProcessingTime': 3.5  # seconds
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'opencv_version': analyzer.get_opencv_version()
    })


if __name__ == '__main__':
    print("=" * 60)
    print("LBW Decision Support System - Backend Server")
    print("=" * 60)
    print(f"OpenCV Version: {analyzer.get_opencv_version()}")
    print(f"Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print(f"Results folder: {os.path.abspath(RESULTS_FOLDER)}")
    print("=" * 60)
    print("Starting server on http://localhost:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
