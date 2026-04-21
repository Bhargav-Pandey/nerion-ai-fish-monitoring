import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier
import joblib
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

def generate_synthetic_data(num_samples=200):
    """Generates synthetic aquaculture data for training."""
    print(f"Generating {num_samples} samples of synthetic aquaculture data...")
    data = []
    labels = []
    
    for _ in range(num_samples // 4):
        # 1. Healthy Conditions (Optimal ranges)
        data.append([np.random.uniform(24, 28), np.random.uniform(6.5, 7.5), np.random.uniform(0, 8), np.random.uniform(0, 0.1)])
        labels.append("Healthy")
        
        # 2. Ammonia Poisoning (High Ammonia)
        data.append([np.random.uniform(24, 28), np.random.uniform(7.0, 8.5), np.random.uniform(5, 15), np.random.uniform(0.5, 2.0)])
        labels.append("Ammonia Poisoning")
        
        # 3. Heat Stress (High Temp)
        data.append([np.random.uniform(30, 34), np.random.uniform(6.5, 8.0), np.random.uniform(0, 10), np.random.uniform(0, 0.2)])
        labels.append("Heat Stress")
        
        # 4. Bacterial Infection Vulnerability (High Turbidity, poor pH)
        data.append([np.random.uniform(20, 26), np.random.uniform(4.0, 6.0), np.random.uniform(20, 50), np.random.uniform(0, 0.3)])
        labels.append("Bacterial Infection")

    df = pd.DataFrame(data, columns=['Temperature', 'pH', 'Turbidity', 'Ammonia'])
    y = pd.Series(labels)
    return df, y

def train_and_save_model():
    """Trains the ML model and saves it to disk."""
    # 1. Get the data
    X, y = generate_synthetic_data(400) # Generating 400 rows of training data
    
    # 2. Initialize and train the Decision Tree
    print("Training Decision Tree Classifier...")
    model = DecisionTreeClassifier(random_state=42, max_depth=5)
    model.fit(X, y)
    
    # 3. Save the model to a file using joblib
    model_filename = 'fish_ai_model.pkl'
    joblib.dump(model, model_filename)
    print(f"✅ Model trained and successfully saved as '{model_filename}'!")

if __name__ == "__main__":
    train_and_save_model()