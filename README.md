# Nerion AI — Fish Monitoring

An AI-powered fish health and water quality monitoring system. A Flask backend ingests sensor readings (temperature, pH, turbidity, ammonia), classifies fish health risk with a trained ML model, and can generate plain-language diagnostic reports via the Groq LLM API.

## Features

- **Real-time sensor ingestion** — logs temperature, pH, turbidity, and ammonia readings to a SQLite database.
- **Water quality status** — rule-based classification into Healthy / Warning / Danger.
- **ML disease prediction** — a scikit-learn Decision Tree Classifier predicts conditions such as Ammonia Poisoning, Heat Stress, and Bacterial Infection.
- **AI-generated health reports** — optional integration with Groq (Llama 3.1) for structured, human-readable explanations of diagnoses.
- **Hardware simulator** — a standalone script that mimics an ESP32 sensor feed for local testing without physical hardware.
- **User accounts** — basic signup/login for dashboard access.

## Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-CORS
- **ML:** scikit-learn, pandas, joblib
- **LLM:** Groq API (Llama 3.1)
- **Database:** SQLite

## Project Structure

```
backend/
├── app.py                 # Flask app: routes, models, ML + LLM integration
├── train_model.py         # Trains and saves the disease-prediction model
├── simulate_hardware.py   # Simulates sensor data for local testing
├── fish_ai_model.pkl      # Trained model artifact
├── requirements.txt
├── static/
├── templates/
└── instance/               # SQLite database (created at runtime)
```

## Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd nerion-ai-fish-monitoring/backend
   ```

2. **Create a virtual environment and install dependencies**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   ```

3. **Configure environment variables**

   Create a `.env` file inside `backend/`:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
   The app runs without this key, but AI-generated explanations will be disabled.

4. **Train the ML model** (generates `fish_ai_model.pkl`)
   ```bash
   python train_model.py
   ```

5. **Run the server**
   ```bash
   python app.py
   ```
   The app serves on `http://0.0.0.0:5000`.

6. **(Optional) Simulate sensor data**

   In a separate terminal, with the server running:
   ```bash
   python simulate_hardware.py
   ```

## API Endpoints

| Method | Endpoint             | Description                                  |
|--------|-----------------------|-----------------------------------------------|
| POST   | `/api/predict`        | Run AI diagnosis on submitted sensor values (not persisted) |
| POST   | `/api/sensor-data`    | Log sensor readings to the database          |
| POST   | `/api/signup`         | Create a user account                         |
| POST   | `/api/login`          | Authenticate a user                           |
| GET    | `/api/history`        | Retrieve the last 50 sensor readings          |

## License

Add a license of your choice (e.g., MIT).
