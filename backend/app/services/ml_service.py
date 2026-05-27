import os
import pandas as pd
import joblib

ML_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "ml")


class MentalAssessmentResult:
    depression_predicted: bool
    depression_probability: float
    risk_level: str


class MLService:
    """Singleton that loads model artifacts and exposes predict()."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def _load(self):
        if self._loaded:
            return
        self.model = joblib.load(os.path.join(ML_DIR, "model.pkl"))
        self.scaler = joblib.load(os.path.join(ML_DIR, "scaler.pkl"))
        self.feature_cols = joblib.load(os.path.join(ML_DIR, "feature_cols.pkl"))
        self.numeric_cols = joblib.load(os.path.join(ML_DIR, "numeric_cols.pkl"))
        self._loaded = True

    def predict(self, profile: dict, behavior: dict) -> MentalAssessmentResult:
        self._load()

        # Build feature vector matching training columns
        row = {col: 0 for col in self.feature_cols}
        row["Age"] = profile["age"]
        row["Gender_Enc"] = 1 if profile["gender"] == "Female" else 0
        row["CGPA"] = profile["cgpa"]
        row["Sleep_Duration"] = behavior["sleep_duration"]
        row["Study_Hours"] = behavior["study_hours"]
        row["Social_Media_Hours"] = behavior["social_media_hours"]
        row["Physical_Activity"] = behavior["physical_activity"]
        row["Stress_Level"] = behavior["stress_level"]

        dept_col = f"dept_{profile['department']}"
        if dept_col in row:
            row[dept_col] = 1

        X = pd.DataFrame([row])[self.feature_cols]
        X[self.numeric_cols] = self.scaler.transform(X[self.numeric_cols])

        proba = float(self.model.predict_proba(X)[0, 1])
        predicted = proba >= 0.5

        # Risk level
        if predicted or behavior["stress_level"] >= 8:
            risk = "high"
        elif behavior["stress_level"] >= 6:
            risk = "medium"
        else:
            risk = "low"

        result = MentalAssessmentResult()
        result.depression_predicted = predicted
        result.depression_probability = proba
        result.risk_level = risk
        return result
