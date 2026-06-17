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
        model_path = os.path.join(ML_DIR, "model.pkl")
        scaler_path = os.path.join(ML_DIR, "scaler.pkl")
        feature_path = os.path.join(ML_DIR, "feature_cols.pkl")
        numeric_path = os.path.join(ML_DIR, "numeric_cols.pkl")

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model not found at {model_path}. Run: python ml/train.py"
            )

        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
        self.feature_cols = joblib.load(feature_path)
        self.numeric_cols = joblib.load(numeric_path)

        metadata_path = os.path.join(ML_DIR, "feature_metadata.pkl")
        self.feature_metadata = joblib.load(metadata_path) if os.path.exists(metadata_path) else None
        # 使用训练时找到的最优阈值，默认 0.5
        self.optimal_threshold = self.feature_metadata.get("optimal_threshold", 0.5) if self.feature_metadata else 0.5
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

        # Engineered features
        if "Stress_Change_Rate" in self.feature_cols:
            median_s = self.feature_metadata["median_stress"] if self.feature_metadata else 5.0
            row["Stress_Change_Rate"] = (behavior["stress_level"] - median_s) / median_s

        if "Sleep_Quality_Index" in self.feature_cols:
            row["Sleep_Quality_Index"] = behavior["sleep_duration"] * (1 - behavior["stress_level"] / 10)

        if "Lifestyle_Score" in self.feature_cols:
            w = self.feature_metadata["lifestyle_weights"] if self.feature_metadata else {
                "sleep": 0.30, "activity": 0.20, "stress_inv": 0.20,
                "study": 0.15, "social_inv": 0.15,
            }
            row["Lifestyle_Score"] = (
                w["sleep"] * (behavior["sleep_duration"] / 12) +
                w["activity"] * (behavior["physical_activity"] / 200) +
                w["stress_inv"] * (1 - behavior["stress_level"] / 10) +
                w["study"] * (behavior["study_hours"] / 10) +
                w["social_inv"] * (1 - behavior["social_media_hours"] / 10)
            )

        dept_col = f"dept_{profile['department']}"
        if dept_col in row:
            row[dept_col] = 1

        X = pd.DataFrame([row])[self.feature_cols]
        X[self.numeric_cols] = self.scaler.transform(X[self.numeric_cols])

        proba = float(self.model.predict_proba(X)[0, 1])
        predicted = proba >= self.optimal_threshold

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
