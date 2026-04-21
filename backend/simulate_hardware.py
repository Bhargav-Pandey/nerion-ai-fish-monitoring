import requests
import time
import random
import logging

# ==========================================
# CONFIG
# ==========================================
API_URL = "http://127.0.0.1:5000/api/sensor-data"
INTERVAL_SECONDS = 5
REQUEST_TIMEOUT = 10  # seconds

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# ==========================================
# SENSOR STATE (baseline healthy values)
# ==========================================
state = {
    "temperature": 26.5,
    "ph": 7.1,
    "turbidity": 5.0,
    "ammonia": 0.1,
}

# Clamp ranges to keep values realistic
CLAMP = {
    "temperature": (15.0, 40.0),
    "ph": (4.0, 10.0),
    "turbidity": (0.0, 50.0),
    "ammonia": (0.0, 5.0),
}


def clamp(value, min_val, max_val):
    return max(min_val, min(max_val, value))


def simulate_reading():
    """Apply realistic fluctuations to sensor state and return a payload."""
    state["temperature"] += random.uniform(-0.2, 0.2)
    state["ph"] += random.uniform(-0.05, 0.05)
    state["turbidity"] += random.uniform(-0.5, 0.5)

    # 20% chance of an ammonia spike, otherwise slowly filters out
    if random.random() > 0.8:
        state["ammonia"] += random.uniform(0.1, 0.3)
    else:
        state["ammonia"] = max(0.0, state["ammonia"] - 0.05)

    # Clamp all values to realistic bounds
    for key, (lo, hi) in CLAMP.items():
        state[key] = clamp(state[key], lo, hi)

    return {
        "temperature": round(state["temperature"], 1),
        "ph": round(state["ph"], 2),
        "turbidity": round(state["turbidity"], 1),
        "ammonia": round(state["ammonia"], 2),
    }


def send_reading(payload):
    """POST payload to the Flask API. Returns True on success."""
    try:
        response = requests.post(API_URL, json=payload, timeout=REQUEST_TIMEOUT)
        if response.status_code == 201:
            logger.info(
                f"Sent | Temp: {payload['temperature']}°C  "
                f"pH: {payload['ph']}  "
                f"Turbidity: {payload['turbidity']} NTU  "
                f"Ammonia: {payload['ammonia']} ppm"
            )
            return True
        else:
            logger.warning(f"Server returned {response.status_code}: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        logger.error("Connection failed — is app.py running?")
        return False
    except requests.exceptions.Timeout:
        logger.error(f"Request timed out after {REQUEST_TIMEOUT}s.")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Unexpected request error: {e}")
        return False


# ==========================================
# MAIN LOOP
# ==========================================
if __name__ == '__main__':
    logger.info("ESP32 Hardware Simulator started. Press Ctrl+C to stop.")
    while True:
        try:
            payload = simulate_reading()
            send_reading(payload)
        except Exception as e:
            logger.error(f"Unexpected error in simulation loop: {e}")
        time.sleep(INTERVAL_SECONDS)
