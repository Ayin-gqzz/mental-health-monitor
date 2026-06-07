import { useEffect, useState } from "react";
import { getModelEvaluation } from "../../api/counselor";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertCircle } from "lucide-react";

interface CurveData {
  roc: { fpr: number[]; tpr: number[]; auc: number };
  pr: { precision: number[]; recall: number[]; average_precision: number };
  learning: {
    train_sizes: number[];
    train_scores_mean: number[];
    train_scores_std: number[];
    val_scores_mean: number[];
    val_scores_std: number[];
  };
}

export default function ModelEvaluationPage() {
  const [data, setData] = useState<CurveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getModelEvaluation()
      .then(setData)
      .catch(() => setError("模型评估数据未找到，请先运行训练脚本: python ml/train.py"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <div className="spinner-lg spinner" />
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 20px", borderRadius: "var(--radius-md)",
        background: "var(--danger-light)", color: "var(--danger)", fontSize: 14,
      }}>
        <AlertCircle size={18} />
        {error}
      </div>
    </div>
  );

  if (!data) return null;

  const rocPoints = data.roc.fpr.map((fpr, i) => ({ fpr, tpr: data.roc.tpr[i] }));
  const prPoints = data.pr.recall.map((recall, i) => ({ recall, precision: data.pr.precision[i] }));
  const learningPoints = data.learning.train_sizes.map((size, i) => ({
    size,
    train: Number(data.learning.train_scores_mean[i].toFixed(4)),
    val: Number(data.learning.val_scores_mean[i].toFixed(4)),
  }));

  return (
    <div>
      <div className="page-header">
        <h1>🤖 模型评估</h1>
        <p className="subtitle">抑郁预测模型的性能指标和评估曲线</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* ROC Curve */}
        <div className="chart-card">
          <h3 style={{ marginBottom: 4 }}>ROC 曲线</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
            AUC = <strong style={{ color: "var(--primary)" }}>{data.roc.auc.toFixed(4)}</strong>
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={rocPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="fpr" fontSize={11} stroke="var(--text-muted)" label={{ value: "假阳性率 (FPR)", position: "insideBottom", offset: -5 }} />
              <YAxis fontSize={11} stroke="var(--text-muted)" label={{ value: "真阳性率 (TPR)", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v: any) => Number(v).toFixed(4)} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }} />
              <Line type="monotone" dataKey="tpr" stroke="#ef4444" name="ROC" strokeWidth={2.5} dot={false} />
              <Line type="monotone" data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]} dataKey="tpr" stroke="var(--border)" strokeDasharray="5 5" name="随机" dot={false} strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* PR Curve */}
        <div className="chart-card">
          <h3 style={{ marginBottom: 4 }}>PR 曲线</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
            AP = <strong style={{ color: "var(--primary)" }}>{data.pr.average_precision.toFixed(4)}</strong>
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={prPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="recall" fontSize={11} stroke="var(--text-muted)" label={{ value: "召回率 (Recall)", position: "insideBottom", offset: -5 }} />
              <YAxis fontSize={11} stroke="var(--text-muted)" label={{ value: "精确率 (Precision)", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v: any) => Number(v).toFixed(4)} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }} />
              <Line type="monotone" dataKey="precision" stroke="#4f6ef7" name="PR" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Learning Curve */}
      <div className="chart-card">
        <h3 style={{ marginBottom: 4 }}>学习曲线</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
          训练集大小 vs F1 分数（3 折交叉验证）
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={learningPoints}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="size" fontSize={11} stroke="var(--text-muted)" label={{ value: "训练样本数", position: "insideBottom", offset: -5 }} />
            <YAxis fontSize={11} stroke="var(--text-muted)" domain={[0, 1]} label={{ value: "F1 分数", angle: -90, position: "insideLeft" }} />
            <Tooltip formatter={(v: any) => Number(v).toFixed(4)} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }} />
            <Legend />
            <Line type="monotone" dataKey="train" stroke="#22c55e" name="训练集" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="val" stroke="#ef4444" name="验证集" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
