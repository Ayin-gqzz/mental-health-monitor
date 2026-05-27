import { useEffect, useState } from "react";
import { getOverviewStats, getDepartmentStats, getAlerts, type OverviewStats, type DepartmentStats } from "../../api/counselor";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, AlertTriangle, Activity, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RISK_COLORS: Record<string, string> = { high: "#e94560", medium: "#f0ad4e", low: "#22c55e" };
const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function CounselorDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [deptStats, setDeptStats] = useState<DepartmentStats[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getOverviewStats().then(setStats);
    getDepartmentStats().then(setDeptStats);
    getAlerts(1, 5).then((r) => setAlerts(r.items));
  }, []);

  if (!stats) return <p>加载中...</p>;

  const pieData = [
    { name: "高风险", value: stats.high_risk_count, color: RISK_COLORS.high },
    { name: "中风险", value: stats.medium_risk_count, color: RISK_COLORS.medium },
    { name: "低风险", value: stats.low_risk_count, color: RISK_COLORS.low },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>辅导员工作台</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={<Users size={24} />} label="学生总数" value={stats.total_students.toLocaleString()} color="#3b82f6" />
        <StatCard icon={<AlertTriangle size={24} />} label="高风险人数" value={stats.high_risk_count.toLocaleString()} color="#e94560" />
        <StatCard icon={<Activity size={24} />} label="平均压力" value={stats.avg_stress.toFixed(1)} color="#f0ad4e" />
        <StatCard icon={<TrendingUp size={24} />} label="抑郁率" value={`${stats.depression_rate}%`} color="#8b5cf6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 16 }}>风险分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 16 }}>各院系抑郁率</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="depression_rate" fill="#e94560" name="抑郁率 (%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3>近期高风险预警</h3>
          <button onClick={() => navigate("/counselor/alerts")} style={{ border: "none", background: "none", color: "#e94560", cursor: "pointer", fontSize: 13 }}>查看全部 →</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["学号", "姓名", "院系", "概率", "日期"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a: any) => (
              <tr key={a.student_id} style={{ borderTop: "1px solid #eee", cursor: "pointer" }} onClick={() => navigate(`/counselor/students/${a.student_id}`)}>
                <td style={{ padding: "10px 16px" }}>{a.student_id}</td>
                <td style={{ padding: "10px 16px" }}>{a.name}</td>
                <td style={{ padding: "10px 16px" }}>{a.department}</td>
                <td style={{ padding: "10px 16px", color: "#e94560", fontWeight: 600 }}>{(a.depression_probability * 100).toFixed(1)}%</td>
                <td style={{ padding: "10px 16px", color: "#888", fontSize: 13 }}>{a.assessment_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ color }}>{icon}</div>
      <div>
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color }}>{value}</p>
      </div>
    </div>
  );
}
