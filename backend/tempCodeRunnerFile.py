from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import pandas as pd
import joblib
import logging
import math
import os
import traceback
from dotenv import load_dotenv

# Optional Groq client support
try:
    from groq import Groq
    _groq_available = True
except ImportError:
    Groq = None
    _groq_available = False

# ==========================================
# CONFIG
# ==========================================
app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Explicitly load .env from the backend directory after logger is configured
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)
logger.info(f"Loading .env from: {env_path}")
if os.path.exists(env_path):
    logger.info(".env file found and loaded.")
    groq_key = os.environ.get("GROQ_API_KEY")
    if groq_key:
        logger.info("GROQ_API_KEY is set in environment.")
    else:
        logger.warning("GROQ_API_KEY not found in .env file.")
else:
    logger.warning(".env file not found at expected location.")

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)   # ensure folder exists before DB init
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(INSTANCE_DIR, "aquaguard.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ==========================================
# MODELS
# ==========================================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

    def to_dict(self):
        return {"id": self.id, "username": self.username}


class SensorLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    temperature = db.Column(db.Float, nullable=False)
    ph = db.Column(db.Float, nullable=False)
    turbidity = db.Column(db.Float, nullable=False)
    ammonia = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "temperature": self.temperature,
            "ph": self.ph,
            "turbidity": self.turbidity,
            "ammonia": self.ammonia
        }

with app.app_context():
    db.create_all()

# ==========================================
# ML SETUP
# ==========================================
MODEL_FILE = os.path.join(BASE_DIR, 'fish_ai_model.pkl')

disease_model = None
if os.path.exists(MODEL_FILE):
    try:
        disease_model = joblib.load(MODEL_FILE)
        logger.info("ML model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load ML model: {e}")
else:
    logger.warning(f"Model file not found at '{MODEL_FILE}'. Run train_model.py first.")

TREATMENT_DB = {
    "Healthy": {
        "danger": "Low",
        "solution": "No action needed.",
        "precautions": "Maintain regular monitoring."
    },
    "Ammonia Poisoning": {
        "danger": "Critical",
        "solution": "Perform 50% water change immediately. Add ammonia binding agent.",
        "precautions": "Reduce feeding, clean bio-filters."
    },
    "Heat Stress": {
        "danger": "High",
        "solution": "Turn on emergency aerators. Introduce cooler water gradually.",
        "precautions": "Install automated cooling and shade covers."
    },
    "Bacterial Infection": {
        "danger": "Medium",
        "solution": "Treat water with mild antibacterial agents.",
        "precautions": "Maintain regular tank vacuuming."
    }
}

# ==========================================
# HELPERS
# ==========================================
SENSOR_FIELDS = {
    "temperature": (0.0, 50.0),
    "ph": (0.0, 14.0),
    "turbidity": (0.0, 100.0),
    "ammonia": (0.0, 10.0),
}

def parse_and_validate(data):
    """
    Parse and validate sensor fields from a request payload.
    Returns (values_dict, error_message). On success error_message is None.
    """
    if not data or not isinstance(data, dict):
        return None, "Request body must be a JSON object."

    values = {}
    for field, (min_val, max_val) in SENSOR_FIELDS.items():
        raw = data.get(field)
        if raw is None:
            return None, f"Missing required field: '{field}'."
        try:
            val = float(raw)
        except (TypeError, ValueError):
            return None, f"Field '{field}' must be a number, got: {repr(raw)}."
        if math.isnan(val) or math.isinf(val):
            return None, f"Field '{field}' must be a finite number."
        if not (min_val <= val <= max_val):
            return None, f"Field '{field}' out of range [{min_val}, {max_val}], got: {val}."
        values[field] = val

    return values, None


def run_ml_prediction(temp, ph, turbidity, ammonia):
    """Run ML prediction and return ai_data dict."""
    if disease_model is None:
        return {
            "disease": "Model Offline",
            "danger": "Unknown",
            "solution": "Run train_model.py to enable AI predictions.",
            "precautions": "Manual monitoring required."
        }
    try:
        features = pd.DataFrame(
            [[temp, ph, turbidity, ammonia]],
            columns=['Temperature', 'pH', 'Turbidity', 'Ammonia']
        )
        predicted = disease_model.predict(features)[0]
        treatment = TREATMENT_DB.get(predicted, {
            "danger": "Unknown",
            "solution": "Consult a specialist.",
            "precautions": "Monitor closely."
        })
        return {
            "disease": predicted,
            "danger": treatment["danger"],
            "solution": treatment["solution"],
            "precautions": treatment["precautions"]
        }
    except Exception as e:
        logger.error(f"ML prediction error: {e}")
        return {
            "disease": "Prediction Error",
            "danger": "Unknown",
            "solution": "An error occurred during prediction.",
            "precautions": "Check server logs."
        }


def compute_status(temp, ph, turbidity, ammonia):
    """Compute water quality status and color."""
    if 24 <= temp <= 30 and 6.5 <= ph <= 8.0 and turbidity < 10 and ammonia < 0.2:
        return "Healthy", "green"
    if 22 <= temp <= 32 and 6.0 <= ph <= 8.5 and turbidity < 15 and ammonia < 0.5:
        return "Warning", "orange"
    return "Danger", "red"


# NEW
_groq_client = None

def _get_groq_client():
    """Lazy-init the Groq client."""
    global _groq_client
    if _groq_client is None:
        if not _groq_available or Groq is None:
            logger.warning("Groq client not available: groq library not imported.")
            return None
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            logger.warning("GROQ_API_KEY environment variable not set. AI explanations will be unavailable.")
            return None
        logger.info("Initializing Groq client with API key.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client


# NEW
def generate_ai_explanation(temp, ph, turbidity, ammonia, disease):
    """
    Call Groq (Llama 3) to produce a structured fish health report.
    Returns a plain-text string. Falls back gracefully on any error.
    """
    client = _get_groq_client()
    if client is None:
        return "AI explanation unavailable — set the GROQ_API_KEY environment variable to enable this feature."

    prompt = f"""You are an expert aquaculture veterinarian AI assistant.

A fish health monitoring system has recorded the following water parameters:
- Temperature: {temp}°C
- pH: {ph}
- Turbidity: {turbidity} NTU
- Ammonia: {ammonia} ppm

The ML model has diagnosed the condition as: {disease}

Write a concise, structured health report with exactly these five sections:
1. Fish Health Analysis
2. Habitat Condition
3. Risk Factors
4. Action Plan
5. Preventive Measures

Keep each section to 2-3 sentences. Use plain language suitable for a fish farm operator."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return f"AI explanation temporarily unavailable. ({type(e).__name__})"

# ==========================================
# ROUTES
# ==========================================
@app.route('/')
def home():
    return render_template('index.html')


@app.route('/login')
def login_page():
    return render_template('login.html')


@app.route('/api/predict', methods=['POST'])
def manual_prediction():
    """AI diagnosis from dashboard — does not save to DB."""
    try:
        data = request.get_json(silent=True)
        values, error = parse_and_validate(data)
        if error:
            return jsonify({"success": False, "message": error, "data": {}}), 400

        temp = values['temperature']
        ph = values['ph']
        turbidity = values['turbidity']
        ammonia = values['ammonia']

        status, color = compute_status(temp, ph, turbidity, ammonia)
        
        # Try ML prediction with detailed error handling
        try:
            ai_data = run_ml_prediction(temp, ph, turbidity, ammonia)
        except Exception as ml_err:
            logger.error(f"ML prediction failed: {ml_err}\n{traceback.format_exc()}")
            ai_data = {
                "disease": "ML Error",
                "danger": "Unknown",
                "solution": f"ML prediction failed: {type(ml_err).__name__}: {str(ml_err)}",
                "precautions": "Check server logs or retrain model with train_model.py"
            }

        # Try LLM explanation with detailed error handling
        try:
            ai_explanation = generate_ai_explanation(temp, ph, turbidity, ammonia, ai_data["disease"])
        except Exception as llm_err:
            logger.error(f"LLM explanation failed: {llm_err}\n{traceback.format_exc()}")
            ai_explanation = f"LLM explanation failed: {type(llm_err).__name__}: {str(llm_err)}"

        return jsonify({
            "success": True,
            "message": "Prediction successful.",
            "data": {
                "status": status,
                "color": color,
                "ai_prediction": ai_data,
                "ai_explanation": ai_explanation   # NEW
            }
        }), 200

    except Exception as e:
        logger.error(f"/api/predict outer error: {e}\n{traceback.format_exc()}")
        return jsonify({"success": False, "message": f"{type(e).__name__}: {str(e)}", "data": {}}), 500


@app.route('/api/sensor-data', methods=['POST'])
def receive_sensor_data():
    """Receive sensor readings from hardware/simulator and persist to DB."""
    try:
        data = request.get_json(silent=True)
        values, error = parse_and_validate(data)
        if error:
            return jsonify({"success": False, "message": error, "data": {}}), 400

        new_log = SensorLog(
            temperature=values['temperature'],
            ph=values['ph'],
            turbidity=values['turbidity'],
            ammonia=values['ammonia']
        )
        db.session.add(new_log)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Sensor data logged successfully.",
            "data": {"id": new_log.id}
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"/api/sensor-data error: {e}")
        return jsonify({"success": False, "message": "Failed to save sensor data.", "data": {}}), 500


@app.route('/api/signup', methods=['POST'])
def signup():
    """Register a new user."""
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Request body must be a JSON object.", "data": {}}), 400

        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()

        if not username or not password:
            return jsonify({"success": False, "message": "Username and password are required.", "data": {}}), 400
        if len(username) < 3:
            return jsonify({"success": False, "message": "Username must be at least 3 characters.", "data": {}}), 400
        if len(password) < 4:
            return jsonify({"success": False, "message": "Password must be at least 4 characters.", "data": {}}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({"success": False, "message": "Username already exists.", "data": {}}), 409

        new_user = User(username=username, password=password)
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Account created successfully.",
            "data": new_user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"/api/signup error: {e}")
        return jsonify({"success": False, "message": "Failed to create account.", "data": {}}), 500


@app.route('/api/login', methods=['POST'])
def login():
    """Verify username and password."""
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Request body must be a JSON object.", "data": {}}), 400

        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()

        if not username or not password:
            return jsonify({"success": False, "message": "Username and password are required.", "data": {}}), 400

        user = User.query.filter_by(username=username, password=password).first()
        if not user:
            return jsonify({"success": False, "message": "Invalid username or password.", "data": {}}), 401

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "data": user.to_dict()
        }), 200

    except Exception as e:
        logger.error(f"/api/login error: {e}")
        return jsonify({"success": False, "message": "Login failed.", "data": {}}), 500


@app.route('/api/history', methods=['GET'])
def get_sensor_history():
    """Return the last 50 sensor readings, newest first."""
    try:
        limit = 50
        logs = (
            SensorLog.query
            .order_by(SensorLog.timestamp.desc())
            .limit(limit)
            .all()
        )
        return jsonify({
            "success": True,
            "message": f"Returned {len(logs)} records.",
            "data": [log.to_dict() for log in logs]
        }), 200

    except Exception as e:
        logger.error(f"/api/history error: {e}")
        return jsonify({"success": False, "message": "Failed to retrieve history.", "data": {}}), 500


# ==========================================
# ENTRY POINT
# ==========================================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
