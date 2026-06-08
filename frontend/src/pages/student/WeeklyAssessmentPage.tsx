import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  canSubmitWeekly,
  createWeeklyAssessment,
  getWeeklyAssessmentLatest,
  type WeeklyAssessmentLatest,
} from "../../api/student";
import {
  Smile, Moon, BookOpen, Users, Heart,
  Send, CheckCircle, AlertCircle, Clock, MessageSquare,
} from "lucide-react";

interface FormData {
  mood_score: number;
  sleep_quality: number;
  study_state: number;
  social_state: number;
  life_satisfaction: number;
  message: string;
}

const SCORE_LABELS = ["", "非常差", "较差", "一般", "较好", "非常好"];
const SCORE_COLORS = ["", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981"];

export default function WeeklyAssessmentPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [latest, setLatest] = useState<WeeklyAssessmentLatest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormData>({
    mood_score: 3,
    sleep_quality: 3,
    study_state: 3,
    social_state: 3,
    life_satisfaction: 3,
    message: "",
  });

  useEffect(() => {
    Promise.all([canSubmitWeekly(), getWeeklyAssessmentLatest()])
      .then(([canResult, latestResult]) => {
        setSubmitted(canResult.submitted);
        setLatest(latestResult);
      })
      .catch(() => {
        // 如果 API 失败（比如表不存在），默认显示提交表单
        setSubmitted(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await createWeeklyAssessment({
        mood_score: form.mood_score,
        sleep_quality: form.sleep_quality,
        study_state: form.study_state,
        social_state: form.social_state,
        life_satisfaction: form.life_satisfaction,
        message: form.message || undefined,
      });
      setSuccess(true);
      setSubmitted(true);
      // 重新获取最新数据
      const latestResult = await getWeeklyAssessmentLatest();
      setLatest(latestResult);
    } catch (err: any) {
      setError(err.response?.data?.detail || "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const getOverallColor = (score: number) => {
    if (score >= 4) return "#22c55e";
    if (score >= 3) return "#f59e0b";
    if (score >= 2) return "#f97316";
    return "#ef4444";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner-lg spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="page-header">
        <h1>📝 每周心理测评</h1>
        <p className="subtitle">每周提交一次心理状态自评，帮助您了解自己的心理健康状况</p>
      </div>

      {/* 已提交提示 */}
      {submitted && !success && (
        <div className="card" style={{ padding: 24, marginBottom: 24, textAlign: "center" }}>
          <CheckCircle size={48} style={{ color: "var(--success)", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>本周已提交</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            您本周的心理测评已提交，下周再来吧！
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/student")}>
            返回首页
          </button>
        </div>
      )}

      {/* 提交成功 */}
      {success && (
        <div className="card" style={{ padding: 24, marginBottom: 24, textAlign: "center" }}>
          <CheckCircle size={48} style={{ color: "var(--success)", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>提交成功！</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            感谢您的心理测评，您的数据将帮助我们更好地了解您的状态。
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/student")}>
            返回首页
          </button>
        </div>
      )}

      {/* 提交表单 */}
      {!submitted && !success && (
        <div className="card" style={{ padding: 28 }}>
          <h3 style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
            <Heart size={20} style={{ color: "var(--danger)" }} />
            本周心理状态自评
          </h3>

          <div style={{ display: "grid", gap: 24 }}>
            <ScoreItem
              icon={<Smile size={18} />}
              label="情绪状态"
              description="本周整体情绪如何？"
              value={form.mood_score}
              onChange={(v) => setForm({ ...form, mood_score: v })}
            />
            <ScoreItem
              icon={<Moon size={18} />}
              label="睡眠质量"
              description="本周睡眠质量如何？"
              value={form.sleep_quality}
              onChange={(v) => setForm({ ...form, sleep_quality: v })}
            />
            <ScoreItem
              icon={<BookOpen size={18} />}
              label="学习状态"
              description="本周学习状态如何？"
              value={form.study_state}
              onChange={(v) => setForm({ ...form, study_state: v })}
            />
            <ScoreItem
              icon={<Users size={18} />}
              label="社交状态"
              description="本周社交状态如何？"
              value={form.social_state}
              onChange={(v) => setForm({ ...form, social_state: v })}
            />
            <ScoreItem
              icon={<Heart size={18} />}
              label="生活满意度"
              description="本周整体生活满意度如何？"
              value={form.life_satisfaction}
              onChange={(v) => setForm({ ...form, life_satisfaction: v })}
            />
          </div>

          {/* 留言 */}
          <div style={{ marginTop: 28 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
              <MessageSquare size={16} />
              留言（可选）
            </label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="有什么想说的吗？可以写下您最近的感受、困扰或任何想法..."
              className="input"
              style={{ height: 100, resize: "vertical" }}
              maxLength={500}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
              {form.message.length}/500
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "var(--danger-light)", color: "var(--danger)",
              fontSize: 13, marginTop: 16,
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: "100%", marginTop: 24, padding: "12px 0", fontSize: 14 }}
          >
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                提交中...
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Send size={16} />
                提交测评
              </span>
            )}
          </button>
        </div>
      )}

      {/* 最近一次测评结果 */}
      {latest && (
        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <h3 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} style={{ color: "var(--primary)" }} />
            最近一次测评
          </h3>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20, padding: 20, background: "var(--bg-page)", borderRadius: "var(--radius-md)",
          }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: `conic-gradient(${getOverallColor(latest.overall_score)} ${latest.overall_score / 5 * 360}deg, var(--border-light) 0)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                background: "#fff", width: 76, height: 76, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
              }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: getOverallColor(latest.overall_score) }}>
                  {latest.overall_score.toFixed(1)}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>/ 5.0</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <ScoreDisplay label="情绪" score={latest.mood_score} />
            <ScoreDisplay label="睡眠" score={latest.sleep_quality} />
            <ScoreDisplay label="学习" score={latest.study_state} />
            <ScoreDisplay label="社交" score={latest.social_state} />
            <ScoreDisplay label="满意度" score={latest.life_satisfaction} />
          </div>

          <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            提交日期：{latest.submit_date}
          </p>

          {latest.message && (
            <div style={{
              marginTop: 16, padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)",
              fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8,
            }}>
              <p style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>💬 您的留言</p>
              {latest.message}
            </div>
          )}

          {latest.counselor_reply && (
            <div style={{
              marginTop: 12, padding: 16, background: "var(--primary-light)", borderRadius: "var(--radius-md)",
              fontSize: 13, color: "var(--primary)", lineHeight: 1.8,
            }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>👨‍🏫 辅导员回复</p>
              {latest.counselor_reply}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreItem({ icon, label, description, value, onChange }: {
  icon: React.ReactNode; label: string; description: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "var(--primary)" }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— {description}</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            onClick={() => onChange(score)}
            style={{
              flex: 1, padding: "10px 0", border: "2px solid",
              borderColor: value === score ? SCORE_COLORS[score] : "var(--border)",
              borderRadius: "var(--radius-md)",
              background: value === score ? SCORE_COLORS[score] + "15" : "var(--bg-card)",
              color: value === score ? SCORE_COLORS[score] : "var(--text-secondary)",
              cursor: "pointer", fontSize: 13, fontWeight: value === score ? 600 : 400,
              transition: "all var(--transition-fast)",
            }}
          >
            {score}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: SCORE_COLORS[value], marginTop: 4, fontWeight: 500 }}>
        {SCORE_LABELS[value]}
      </p>
    </div>
  );
}

function ScoreDisplay({ label, score }: { label: string; score: number }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 12px", background: "var(--bg-page)", borderRadius: "var(--radius-sm)",
    }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: SCORE_COLORS[score] }}>{score}/5</span>
    </div>
  );
}
