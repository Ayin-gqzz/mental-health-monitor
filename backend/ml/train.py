"""
Train Random Forest classifier for depression prediction.
Run from backend/: python ml/train.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
)
from imblearn.over_sampling import SMOTE
import joblib

ML_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(ML_DIR, "..", "..", "..", "数据集.csv")
CSV_PATH = os.path.normpath(CSV_PATH)


def main():
    print("=" * 60)
    print("Mental Health Depression Prediction — Model Training")
    print("=" * 60)

    # 1. Load data
    print("\n[1/6] Loading data...")
    df = pd.read_csv(CSV_PATH)
    print(f"  Loaded {len(df)} rows, {len(df.columns)} columns")

    # 2. Feature engineering
    print("\n[2/6] Feature engineering...")
    df["Gender_Enc"] = df["Gender"].map({"Male": 0, "Female": 1})
    df_encoded = pd.get_dummies(df, columns=["Department"], prefix="dept")

    feature_cols = [
        "Age", "Gender_Enc", "CGPA", "Sleep_Duration", "Study_Hours",
        "Social_Media_Hours", "Physical_Activity", "Stress_Level",
        "dept_Arts", "dept_Business", "dept_Engineering", "dept_Medical", "dept_Science",
    ]

    X = df_encoded[feature_cols].copy()
    y = df_encoded["Depression"].map({True: 1, False: 0}).values

    numeric_cols = ["Age", "CGPA", "Sleep_Duration", "Study_Hours",
                    "Social_Media_Hours", "Physical_Activity", "Stress_Level"]

    print(f"  Features: {len(feature_cols)}, Positive samples: {y.sum()} ({y.sum()/len(y)*100:.1f}%)")

    # 3. Train/test split
    print("\n[3/6] Train/test split (80/20, stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42,
    )
    print(f"  Train: {len(X_train)}, Test: {len(X_test)}")

    # 4. Scale numeric features
    print("\n[4/6] Scaling numeric features...")
    scaler = StandardScaler()
    X_train_scaled = X_train.copy()
    X_test_scaled = X_test.copy()
    X_train_scaled[numeric_cols] = scaler.fit_transform(X_train[numeric_cols])
    X_test_scaled[numeric_cols] = scaler.transform(X_test[numeric_cols])

    # 5. Handle class imbalance with SMOTE
    print("\n[5/6] Applying SMOTE + training Random Forest...")
    smote = SMOTE(random_state=42)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train_scaled, y_train)
    print(f"  After SMOTE: {len(X_train_resampled)} samples ({y_train_resampled.sum()} positive)")

    # Train Random Forest with GridSearch
    param_grid = {
        "n_estimators": [100, 200],
        "max_depth": [10, 15, None],
        "min_samples_split": [2, 5],
        "min_samples_leaf": [1, 2],
    }

    rf = RandomForestClassifier(random_state=42, class_weight="balanced", n_jobs=-1)
    grid = GridSearchCV(rf, param_grid, cv=3, scoring="f1", n_jobs=-1, verbose=1)
    grid.fit(X_train_resampled, y_train_resampled)

    print(f"  Best params: {grid.best_params_}")
    print(f"  Best CV F1: {grid.best_score_:.4f}")

    # 6. Evaluate
    print("\n[6/6] Evaluation on test set...")
    model = grid.best_estimator_
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  ROC-AUC:   {auc:.4f}")
    print(f"\n  Confusion Matrix:\n{confusion_matrix(y_test, y_pred)}")
    print(f"\n  Classification Report:\n{classification_report(y_test, y_pred, target_names=['No Depression', 'Depression'])}")

    # Feature importance
    print("\n  Feature Importance:")
    for name, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: -x[1]):
        print(f"    {name:25s}: {imp:.4f}")

    # Save artifacts
    model_path = os.path.join(ML_DIR, "model.pkl")
    scaler_path = os.path.join(ML_DIR, "scaler.pkl")
    features_path = os.path.join(ML_DIR, "feature_cols.pkl")
    numeric_path = os.path.join(ML_DIR, "numeric_cols.pkl")

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(feature_cols, features_path)
    joblib.dump(numeric_cols, numeric_path)

    print(f"\n  Artifacts saved to {ML_DIR}/")
    print(f"    model.pkl, scaler.pkl, feature_cols.pkl, numeric_cols.pkl")
    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
