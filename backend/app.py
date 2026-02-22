"""
LBW Decision Support System - Flask Backend
Production-ready version for Render deployment
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

# ==============================
# Configuration
# ==============================

UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

storage = AnalysisStorage(RESULTS_FOLDER)
analyzer = LBWAnalyzer()

# ==============================
# ROOT ROUTE (Prevents 404)
# ==============================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "LBW Backend is Running Successfully 🚀",
        "status": "OK"
    })

# ==============================
# Utility
# ==============================

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==============================
# SSE Generator
# ==============================

def generate_analysis_events(analysis_id, video_path, file_hash):
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
        yield f"data: {json.dumps({'step': 'starting', 'progress': 0})}\n\n"

        result = None

        for i, (step_id, message) in enumerate(steps):
            progress = int((i / len(steps)) * 100)
            yield f"data: {json.dumps({'step': step_id, 'message': message, 'progress': progress})}\n\n"

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

            time.sleep(0.2)

        if result is None:
            result = analyzer.get_result()

        result.update({
            "id": analysis_id,
            "videoName": os.path.basename(video_path),
            "fileHash": file_hash,
            "timestamp": datetime.now().isoformat(),
            "status": "completed"
        })

        storage.save_result(analysis_id, result)

        yield f"data: {json.dumps({'step': 'completed', 'progress': 100, 'result': result})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'step': 'error', 'message': str(e)})}\n\n"

# ==============================
# API Routes
# ==============================

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    file = request.files['video']
    file_hash = request.form.get('fileHash', '')

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    if file_hash:
        existing = storage.find_by_hash(file_hash)
        if existing:
            return jsonify({'cached': True, 'result': existing})

    analysis_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{analysis_id}_{filename}")
    file.save(video_path)

    return Response(
        generate_analysis_events(analysis_id, video_path, file_hash),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache'}
    )

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "version": "1.0.0",
        "opencv_version": analyzer.get_opencv_version()
    })

# ==============================
# Run Server
# ==============================

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))   # IMPORTANT FOR RENDER
    app.run(host='0.0.0.0', port=port)