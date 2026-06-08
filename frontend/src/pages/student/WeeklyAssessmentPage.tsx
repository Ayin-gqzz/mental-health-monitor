import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createWeeklyAssessment, getWeeklyAssessmentLatest } from "../../api/student";
import { Send, CheckCircle, ArrowLeft } from "lucide-react";

const DIMS = [
  { key: "mood_score", label: "情绪状态", desc: "本周整体情绪如何？" },
  { key: "sleep_quality", label: "睡眠质量", desc: "本周睡眠质量如何？" },
  { key: "study_state", label: "学习状态", desc: "本周学习状态如何？" },
  { key: "social_state", label: "社交状态", desc: "本周社交状态如何？" },
  { key: "life_satisfaction", label: "生活满意度", desc: "本周整体生活满意度如何？" },
] as const;

const LABELS = ["", "非常差", "较差", "一般", "较好", "非常好"];
const COLORS = ["", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981"];

export default function WeeklyAssessmentPage() {
  const navigate = useNavigate();
  const [scores, setScores] = useState<Record<string, number>>({
    mood_score: 3, sleep_quality: 3, study_state: 3, social_state: 3, life_satisfaction: 3,
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    getWeeklyAssessmentLatest()
      .then((data) => {
        if (data && data.submit_date) {
          // 检查是否本周已提交
          const submitDate = new Date(data.submit_date);
          const now = new Date();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          if (submitDate >= weekStart) {
            setAlreadySubmitted(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  const setScore = (key: string, val: number) => setScores((prev) => ({ ...prev, [key]: val }));

  const overall = (
    scores.mood_score * 0.25 +
    scores.sleep_quality * 0.20 +
    scores.study_state * 0.20 +
    scores.social_state * 0.15 +
    scores.life_satisfaction * 0.20
  ).toFixed(1);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await createWeeklyAssessment({
        mood_score: scores.mood_score,
        sleep_quality: scores.sleep_quality,
        study_state: scores.study_state,
        social_state: scores.social_state,
        life_satisfaction: scores.life_satisfaction,
        message: message || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "提交失败，请确认后端已启动";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 已提交成功
  if (submitted) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <CheckCircle size={64} style={{ color: "#22c55e", marginBottom: 20 }} />
        <h1 style={{ marginBottom: 8 }}>提交成功！</h1>
        <p style={{ color: "#64748b", marginBottom: 8 }}>感谢你的心理测评</p>
        <p style={{ color: "#64748b", marginBottom: 24 }}>综合评分：<strong style={{ color: COLORS[Math.round(Number(overall))] }}>{overall}</strong> / 5.0</p>
        <button className="btn btn-primary" onClick={() => navigate("/student")}>返回首页</button>
      </div>
    );
  }

  // 本周已提交
  if (alreadySubmitted) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <CheckCircle size={64} style={{ color: "#4f6ef7", marginBottom: 20 }} />
        <h1 style={{ marginBottom: 8 }}>本周已提交</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>你本周的心理测评已完成，请下周再来</p>
        <button className="btn btn-primary" onClick={() => navigate("/student")}>返回首页</button>
      </div>
    );
  }

  // 提交表单
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/student")} style={{ padding: "6px 8px" }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>📝 每周心理测评</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>每周提交一次，帮助了解你的心理状态</p>
        </div>
      </div>

      {/* 评分项 */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        {DIMS.map(({ key, label, desc }) => (
          <div key={key} style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
              <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>{desc}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setScore(key, v)}
                  style={{
                    flex: 1, padding: "10px 0",
                    border: `2px solid ${scores[key] === v ? COLORS[v] : "#e2e8f0"}`,
                    borderRadius: 8,
                    background: scores[key] === v ? COLORS[v] + "15" : "#fff",
                    color: scores[key] === v ? COLORS[v] : "#64748b",
                    fontWeight: scores[key] === v ? 600 : 400,
                    cursor: "pointer", fontSize: 14,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: COLORS[scores[key]], marginTop: 4, fontWeight: 500 }}>
              {LABELS[scores[key]]}
            </p>
          </div>
        ))}
      </div>

      {/* 综合评分预览 */}
      <div className="card" style={{ padding: 20, marginBottom: 16, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>综合评分</p>
        <p style={{ fontSize: 36, fontWeight: 700, color: COLORS[Math.round(Number(overall))], margin: 0 }}>
          {overall}
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8" }}>/ 5.0</p>
      </div>

      {/* 留言 */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>💬 留言（可选）</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="写下你最近的感受、困扰或任何想法..."
          className="input"
          style={{ height: 80, resize: "vertical" }}
          maxLength={500}
        />
        <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", marginTop: 4 }}>{message.length}/500</p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 16,
          background: "#fef2f2", color: "#ef4444", fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 提交按钮 */}
      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: "100%", padding: "12px 0", fontSize: 15 }}
      >
        {submitting ? "提交中..." : <><Send size={16} /> 提交测评</>}
      </button>
    </div>
  );
}
