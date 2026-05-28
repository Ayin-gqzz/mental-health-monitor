import { useEffect, useState } from "react";
import { getModelEvaluation } from "../../api/counselor";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts";

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

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#e94560" }}>{error}</p>;
  if (!data) return null;

  // Transform arrays into Recharts-compatible format
  const rocPoints = data.roc.fpr.map((fpr, i) => ({ fpr, tpr: data.roc.tpr[i] }));
  const prPoints = data.pr.recall.map((recall, i) => ({ recall, precision: data.pr.precision[i] }));
  const learningPoints = data.learning.train_sizes.map((size, i) => ({
    size,
    train: Number(data.learning.train_scores_mean[i].toFixed(4)),
    val: Number(data.learning.val_scores_mean[i].toFixed(4)),
  }));

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>模型评估</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* ROC Curve */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 4 }}>ROC 曲线</h3>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>AUC = {data.roc.auc.toFixed(4)}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={rocPoints}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fpr" fontSize={11} label={{ value: "假阳性率 (FPR)", position: "insideBottom", offset: -5 }} />
              <YAxis fontSize={11} label={{ value: "真阳性率 (TPR)", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v: number) => v.toFixed(4)} />
              <Line type="monotone" dataKey="tpr" stroke="#e94560" name="ROC" strokeWidth={2} dot={false} />
              {/* Diagonal reference line */}
              <Line type="monotone" data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]} dataKey="tpr" stroke="#ccc" strokeDasharray="5 5" name="随机" dot={false} strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* PR Curve */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 4 }}>PR 曲线</h3>
          <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>AP = {data.pr.average_precision.toFixed(4)}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={prPoints}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="recall" fontSize={11} label={{ value: "召回率 (Recall)", position: "insideBottom", offset: -5 }} />
              <YAxis fontSize={11} label={{ value: "精确率 (Precision)", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(v: number) => v.toFixed(4)} />
              <Line type="monotone" dataKey="precision" stroke="#3b82f6" name="PR" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Learning Curve */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <h3 style={{ marginBottom: 4 }}>学习曲线</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>训练集大小 vs F1 分数（3 折交叉验证）</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={learningPoints}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="size" fontSize={11} label={{ value: "训练样本数", position: "insideBottom", offset: -5 }} />
            <YAxis fontSize={11} domain={[0, 1]} label={{ value: "F1 分数", angle: -90, position: "insideLeft" }} />
            <Tooltip formatter={(v: number) => v.toFixed(4)} />
            <Legend />
            <Line type="monotone" dataKey="train" stroke="#22c55e" name="训练集" strokeWidth={2} />
            <Line type="monotone" dataKey="val" stroke="#e94560" name="验证集" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
