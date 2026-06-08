import { useEffect, useState } from "react";
import { getDashboard, type DashboardData } from "../../api/student";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Moon, Activity, Brain, ClipboardCheck, Smile } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const RISK_COLORS: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const SCORE_COLORS = ["", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981"];

export default function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <div className="spinner-lg spinner" />
    </div>
  );
  if (!data) return <div className="empty-state"><div className="icon">📋</div><p>加载失败</p></div>;

  const { profile, latest_behavior: b, latest_assessment: a, latest_weekly_assessment: w, trend } = data;
  const riskColor = !a ? "var(--text-muted)" : RISK_COLORS[a.risk_level] || "#999";

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <h1>👋 欢迎回来</h1>
        <p className="subtitle" style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
          查看您的心理健康概况和近期趋势
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard
          icon={<Brain size={22} />}
          label="学分绩点"
          value={profile.cgpa.toFixed(2)}
          color="#4f6ef7"
          bgColor="rgba(79,110,247,0.08)"
        />
        <StatCard
          icon={<Moon size={22} />}
          label="睡眠时长"
          value={b ? `${b.sleep_duration}h` : "暂无"}
          color="#8b5cf6"
          bgColor="rgba(139,92,246,0.08)"
        />
        <StatCard
          icon={<Activity size={22} />}
          label="压力水平"
          value={b ? `${b.stress_level}/10` : "暂无"}
          color={b && b.stress_level >= 8 ? "#ef4444" : "#22c55e"}
          bgColor={b && b.stress_level >= 8 ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)"}
        />
        <StatCard
          icon={<AlertTriangle size={22} />}
          label="风险等级"
          value={a ? RISK_LABELS[a.risk_level] || a.risk_level : "暂无"}
          color={riskColor}
          bgColor={!a ? "rgba(148,163,184,0.08)" : `${riskColor}15`}
        />
      </div>

      {/* Charts & Risk Assessment */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Trend Chart */}
        <div className="chart-card">
          <h3 style={{ marginBottom: 16 }}>📈 12周趋势</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
                }}
              />
              <Line type="monotone" dataKey="avg_stress" stroke="#ef4444" name="压力" strokeWidth={2.5} dot={{ r: 3, fill: "#ef4444" }} />
              <Line type="monotone" dataKey="avg_sleep" stroke="#4f6ef7" name="睡眠 (h)" strokeWidth={2.5} dot={{ r: 3, fill: "#4f6ef7" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Assessment */}
        <div className="chart-card" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h3 style={{ marginBottom: 20 }}>🎯 风险评估</h3>
          {a ? (
            <>
              <div style={{
                width: 130, height: 130, borderRadius: "50%",
                background: `conic-gradient(${riskColor} ${a.depression_probability * 360}deg, var(--border-light) 0)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 20,
                boxShadow: `0 4px 20px ${riskColor}20`,
              }}>
                <div style={{
                  background: "#fff", width: 100, height: 100, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                  boxShadow: "var(--shadow-sm)",
                }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: riskColor }}>{(a.depression_probability * 100).toFixed(0)}%</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>概率</span>
                </div>
              </div>
              <span className={`badge badge-${a.risk_level === "high" ? "danger" : a.risk_level === "medium" ? "warning" : "success"}`} style={{ fontSize: 13, padding: "4px 14px" }}>
                {RISK_LABELS[a.risk_level] || a.risk_level} 风险
              </span>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                {a.depression_predicted ? "⚠️ 检测到抑郁指标" : "✅ 未检测到抑郁指标"}
              </p>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>暂无评估，请联系辅导员进行评估</p>
          )}
        </div>
      </div>

      {/* Weekly Assessment Card */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <ClipboardCheck size={18} style={{ color: "var(--primary)" }} />
            每周心理测评
          </h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/student/weekly-assessment")}
          >
            {w ? "查看详情" : "去测评"}
          </button>
        </div>

        {w ? (
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: `conic-gradient(${SCORE_COLORS[Math.round(w.overall_score)]} ${w.overall_score / 5 * 360}deg, var(--border-light) 0)`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <div style={{
                background: "#fff", width: 64, height: 64, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: SCORE_COLORS[Math.round(w.overall_score)] }}>
                  {w.overall_score.toFixed(1)}
                </span>
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>/5</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {[
                  { label: "情绪", score: w.mood_score },
                  { label: "睡眠", score: w.sleep_quality },
                  { label: "学习", score: w.study_state },
                  { label: "社交", score: w.social_state },
                  { label: "满意度", score: w.life_satisfaction },
                ].map(({ label, score }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: SCORE_COLORS[score], margin: "2px 0 0" }}>{score}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                上次提交：{w.submit_date}
              </p>
            </div>

            {w.counselor_reply && (
              <div style={{
                padding: 10, background: "var(--primary-light)", borderRadius: "var(--radius-md)",
                fontSize: 12, color: "var(--primary)", maxWidth: 200,
              }}>
                <p style={{ fontWeight: 600, margin: "0 0 4px 0", fontSize: 11 }}>👨‍🏫 辅导员已回复</p>
                <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.counselor_reply}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>
            <Smile size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>本周还未进行心理测评，点击上方按钮开始</p>
          </div>
        )}
      </div>

      {/* Intervention Suggestions */}
      {a?.intervention_text && (
        <div className="chart-card animate-fadeIn">
          <h3 style={{ marginBottom: 14 }}>💡 个性化建议</h3>
          <div style={{
            whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.9, color: "var(--text-secondary)",
            background: "var(--bg-page)", padding: 20, borderRadius: "var(--radius-md)",
          }}>
            {a.intervention_text}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bgColor }: {
  icon: React.ReactNode; label: string; value: string; color: string; bgColor: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bgColor, color }}>
        {icon}
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}
