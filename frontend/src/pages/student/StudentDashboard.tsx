import { useEffect, useState } from "react";
import { getDashboard, type DashboardData } from "../../api/student";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Moon, Activity, Brain } from "lucide-react";

const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>加载中...</p>;
  if (!data) return <p>加载失败</p>;

  const { profile, latest_behavior: b, latest_assessment: a, trend } = data;

  const riskColor = !a ? "#999" : a.risk_level === "high" ? "#e94560" : a.risk_level === "medium" ? "#f0ad4e" : "#22c55e";

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>学生首页</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card icon={<Brain size={24} />} label="学分绩点" value={profile.cgpa.toFixed(2)} color="#3b82f6" />
        <Card icon={<Moon size={24} />} label="睡眠" value={b ? `${b.sleep_duration}h` : "暂无"} color="#8b5cf6" />
        <Card icon={<Activity size={24} />} label="压力" value={b ? `${b.stress_level}/10` : "暂无"} color={b && b.stress_level >= 8 ? "#e94560" : "#22c55e"} />
        <Card icon={<AlertTriangle size={24} />} label="风险" value={a ? RISK_LABELS[a.risk_level] || a.risk_level : "暂无"} color={riskColor} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 16 }}>12周趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="avg_stress" stroke="#e94560" name="压力" strokeWidth={2} />
              <Line type="monotone" dataKey="avg_sleep" stroke="#3b82f6" name="睡眠 (h)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h3 style={{ marginBottom: 16 }}>风险评估</h3>
          {a ? (
            <>
              <div style={{
                width: 120, height: 120, borderRadius: "50%", margin: "0 auto 16px",
                background: `conic-gradient(${riskColor} ${a.depression_probability * 360}deg, #eee 0)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ background: "#fff", width: 90, height: 90, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: riskColor }}>{(a.depression_probability * 100).toFixed(0)}%</span>
                  <span style={{ fontSize: 11, color: "#888" }}>概率</span>
                </div>
              </div>
              <p style={{ color: riskColor, fontWeight: 600 }}>{RISK_LABELS[a.risk_level] || a.risk_level} 风险</p>
              <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                {a.depression_predicted ? "检测到抑郁指标" : "未检测到抑郁指标"}
              </p>
            </>
          ) : (
            <p style={{ color: "#999" }}>暂无评估，请联系辅导员进行评估</p>
          )}
        </div>
      </div>

      {a?.intervention_text && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12 }}>💡 个性化建议</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, lineHeight: 1.8, color: "#333" }}>
            {a.intervention_text}
          </pre>
        </div>
      )}
    </div>
  );
}

function Card({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ color }}>{icon}</div>
      <div>
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color }}>{value}</p>
      </div>
    </div>
  );
}
