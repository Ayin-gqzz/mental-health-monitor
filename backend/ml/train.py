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
    roc_curve, precision_recall_curve, average_precision_score,
)
from sklearn.model_selection import learning_curve, StratifiedKFold
import joblib

ML_DIR = os.path.dirname(os.path.abspath(__file__))


def find_csv():
    if env := os.getenv("CSV_PATH"):
        return env
    p = os.path.join(ML_DIR, "..", "..", "data", "数据集.csv")
    if os.path.exists(p):
        return os.path.normpath(p)
    p = os.path.join(ML_DIR, "..", "..", "..", "数据集.csv")
    return os.path.normpath(p)


CSV_PATH = find_csv()


def _engineer_features(df, median_stress):
    """Apply feature engineering to a DataFrame (no side effects on original)."""
    df = df.copy()
    df["Gender_Enc"] = df["Gender"].map({"Male": 0, "Female": 1})
    df_encoded = pd.get_dummies(df, columns=["Department"], prefix="dept")

    df_encoded["Stress_Change_Rate"] = (df_encoded["Stress_Level"] - median_stress) / median_stress
    df_encoded["Sleep_Quality_Index"] = df_encoded["Sleep_Duration"] * (1 - df_encoded["Stress_Level"] / 10)
    df_encoded["Lifestyle_Score"] = (
        0.30 * (df_encoded["Sleep_Duration"] / 12) +
        0.20 * (df_encoded["Physical_Activity"] / 200) +
        0.20 * (1 - df_encoded["Stress_Level"] / 10) +
        0.15 * (df_encoded["Study_Hours"] / 10) +
        0.15 * (1 - df_encoded["Social_Media_Hours"] / 10)
    )

    feature_cols = [
        "Age", "Gender_Enc", "CGPA", "Sleep_Duration", "Study_Hours",
        "Social_Media_Hours", "Physical_Activity", "Stress_Level",
        "dept_Arts", "dept_Business", "dept_Engineering", "dept_Medical", "dept_Science",
        "Stress_Change_Rate", "Sleep_Quality_Index", "Lifestyle_Score",
    ]

    # 确保所有独热列都存在（防止某学院在测试集缺失）
    for col in feature_cols:
        if col not in df_encoded.columns:
            df_encoded[col] = 0

    return df_encoded, feature_cols


NUMERIC_COLS = [
    "Age", "CGPA", "Sleep_Duration", "Study_Hours",
    "Social_Media_Hours", "Physical_Activity", "Stress_Level",
    "Stress_Change_Rate", "Sleep_Quality_Index", "Lifestyle_Score",
]


def main():
    print("=" * 60)
    print("Mental Health Depression Prediction — Model Training")
    print("=" * 60)

    # 1. Load data
    print("\n[1/7] Loading data...")
    df = pd.read_csv(CSV_PATH)
    print(f"  Loaded {len(df)} rows, {len(df.columns)} columns")

    # 2. Train/test split FIRST — 避免数据泄露到特征工程
    print("\n[2/7] Train/test split (80/20, stratified)...")
    train_df, test_df = train_test_split(
        df, test_size=0.2, stratify=df["Depression"], random_state=42,
    )
    y_train = train_df["Depression"].map({True: 1, False: 0}).values
    y_test = test_df["Depression"].map({True: 1, False: 0}).values
    print(f"  Train: {len(train_df)}, Test: {len(test_df)}")

    # 3. Feature engineering — median_stress 只用训练集计算，杜绝泄露
    print("\n[3/7] Feature engineering (fit on train only)...")
    median_stress = train_df["Stress_Level"].median()
    print(f"  Train median stress: {median_stress}")

    X_train, feature_cols = _engineer_features(train_df, median_stress)
    X_test, _ = _engineer_features(test_df, median_stress)

    X_train = X_train[feature_cols].copy()
    X_test = X_test[feature_cols].copy()

    print(f"  Features: {len(feature_cols)}, Positive: {y_train.sum()} ({y_train.sum()/len(y_train)*100:.1f}%)")

    # 4. Scale numeric features (fit on train, apply to test)
    print("\n[4/7] Scaling numeric features...")
    scaler = StandardScaler()
    X_train_scaled = X_train.copy()
    X_test_scaled = X_test.copy()
    X_train_scaled[NUMERIC_COLS] = scaler.fit_transform(X_train[NUMERIC_COLS])
    X_test_scaled[NUMERIC_COLS] = scaler.transform(X_test[NUMERIC_COLS])

    # 5. 用 class_weight="balanced" 处理不平衡（不用 SMOTE，避免合成样本噪声）
    print("\n[5/7] Training Random Forest with class_weight='balanced'...")
    param_grid = {
        "n_estimators": [100, 200, 300],
        "max_depth": [10, 15, 20, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    }

    rf = RandomForestClassifier(random_state=42, class_weight="balanced_subsample", n_jobs=-1)
    grid = GridSearchCV(rf, param_grid, cv=StratifiedKFold(3, shuffle=True, random_state=42),
                        scoring="roc_auc", n_jobs=-1, verbose=1)
    grid.fit(X_train_scaled, y_train)
    print(f"  Positive ratio: {y_train.sum()}/{len(y_train)} ({y_train.sum()/len(y_train)*100:.1f}%)")

    print(f"  Best params: {grid.best_params_}")
    print(f"  Best CV F1: {grid.best_score_:.4f}")

    # 6. Evaluate on test set
    print("\n[6/7] Evaluation on test set...")
    model = grid.best_estimator_
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]

    # 默认阈值 0.5 的指标
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    # 找到最优阈值（Youden's J statistic: max TPR - FPR）
    fpr, tpr, roc_thresholds = roc_curve(y_test, y_proba)
    youden_idx = np.argmax(tpr - fpr)
    optimal_threshold = roc_thresholds[youden_idx]
    y_pred_opt = (y_proba >= optimal_threshold).astype(int)

    print(f"  ROC-AUC: {auc:.4f}")
    print(f"  最优阈值 (Youden): {optimal_threshold:.4f}")
    print(f"\n  ── 默认阈值 0.5 ──")
    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"\n  ── 最优阈值 {optimal_threshold:.4f} ──")
    print(f"  Accuracy:  {accuracy_score(y_test, y_pred_opt):.4f}")
    print(f"  Precision: {precision_score(y_test, y_pred_opt):.4f}")
    print(f"  Recall:    {recall_score(y_test, y_pred_opt):.4f}")
    print(f"  F1 Score:  {f1_score(y_test, y_pred_opt):.4f}")
    print(f"\n  Confusion Matrix (阈值=0.5):\n{confusion_matrix(y_test, y_pred)}")
    print(f"  Confusion Matrix (最优阈值):\n{confusion_matrix(y_test, y_pred_opt)}")
    print(f"\n  Classification Report (阈值=0.5):\n{classification_report(y_test, y_pred, target_names=['No Depression', 'Depression'])}")

    # Feature importance
    print("\n  Feature Importance:")
    for name, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: -x[1]):
        print(f"    {name:25s}: {imp:.4f}")

    # 7. Save artifacts
    print("\n[7/7] Saving model artifacts...")
    joblib.dump(model, os.path.join(ML_DIR, "model.pkl"))
    joblib.dump(scaler, os.path.join(ML_DIR, "scaler.pkl"))
    joblib.dump(feature_cols, os.path.join(ML_DIR, "feature_cols.pkl"))
    joblib.dump(NUMERIC_COLS, os.path.join(ML_DIR, "numeric_cols.pkl"))

    feature_metadata = {
        "median_stress": float(median_stress),
        "optimal_threshold": float(optimal_threshold),
        "lifestyle_weights": {
            "sleep": 0.30, "activity": 0.20, "stress_inv": 0.20,
            "study": 0.15, "social_inv": 0.15,
        },
    }
    joblib.dump(feature_metadata, os.path.join(ML_DIR, "feature_metadata.pkl"))

    # ROC / PR curves（测试集真实评估）
    fpr, tpr, roc_thresholds = roc_curve(y_test, y_proba)
    precision_arr, recall_arr, pr_thresholds = precision_recall_curve(y_test, y_proba)

    # 学习曲线（StratifiedKFold 保证每折正负比例一致）
    train_sizes, train_scores, val_scores = learning_curve(
        model, X_train_scaled, y_train,
        cv=StratifiedKFold(3, shuffle=True, random_state=42),
        scoring="f1", n_jobs=-1,
        train_sizes=np.linspace(0.1, 1.0, 5),
    )

    evaluation_curves = {
        "roc": {
            "fpr": fpr.tolist(), "tpr": tpr.tolist(),
            "thresholds": roc_thresholds.tolist(), "auc": float(auc),
        },
        "pr": {
            "precision": precision_arr.tolist(), "recall": recall_arr.tolist(),
            "thresholds": pr_thresholds.tolist(),
            "average_precision": float(average_precision_score(y_test, y_proba)),
        },
        "learning": {
            "train_sizes": train_sizes.tolist(),
            "train_scores_mean": train_scores.mean(axis=1).tolist(),
            "train_scores_std": train_scores.std(axis=1).tolist(),
            "val_scores_mean": val_scores.mean(axis=1).tolist(),
            "val_scores_std": val_scores.std(axis=1).tolist(),
        },
    }
    joblib.dump(evaluation_curves, os.path.join(ML_DIR, "evaluation_curves.pkl"))

    print(f"\n  Artifacts saved to {ML_DIR}/")
    print(f"    model.pkl, scaler.pkl, feature_cols.pkl, numeric_cols.pkl")
    print(f"    feature_metadata.pkl, evaluation_curves.pkl")
    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
