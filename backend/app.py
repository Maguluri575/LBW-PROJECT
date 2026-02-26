"""
LBW Decision Support System - Flask Backend
Production-ready version for Render deployment
"""

import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from lbw_analyzer import LBWAnalyzer
from storage import AnalysisStorage

# ==============================
# App Setup
# ==============================

app = Flask(__name__)

# ✅ Proper CORS Configuration (VERY IMPORTANT)
CORS(
    app,
    origins=["https://lbw-project-i4r7.vercel.app"],  # 🔁 Replace if your Vercel URL is different
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)

# ✅ Handle Preflight Requests Explicitly
@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "https://lbw-project-i4r7.vercel.app")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    return response

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
# Root Route
# ==============================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "LBW Backend is Running Successfully 🚀",
        "status": "OK"
    })

# ==============================
# Utility Function
# ==============================

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==============================
# Analyze API
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

    # Check cache
    if file_hash:
        existing = storage.find_by_hash(file_hash)
        if existing:
            return jsonify({'cached': True, 'result': existing})

    analysis_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    video_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{analysis_id}_{filename}")
    file.save(video_path)

    try:
        # Run analysis steps sequentially
        analyzer.preprocess_video(video_path)
        analyzer.detect_ball()
        analyzer.track_ball()
        analyzer.detect_legs()
        analyzer.detect_impact()
        analyzer.detect_bounce()
        analyzer.extrapolate_trajectory()
        analyzer.predict_wicket_hit()

        result = analyzer.generate_decision()

        result.update({
            "id": analysis_id,
            "videoName": filename,
            "fileHash": file_hash,
            "timestamp": datetime.now().isoformat(),
            "status": "completed"
        })

        storage.save_result(analysis_id, result)

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==============================
# Health Check
# ==============================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "version": "1.0.0",
        "opencv_version": analyzer.get_opencv_version()
    })

# ==============================
# Run Server (For Render)
# ==============================

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)