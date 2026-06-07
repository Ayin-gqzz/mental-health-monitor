import { useEffect, useState } from "react";
import { getOverviewStats, getDepartmentStats, getAlerts, type OverviewStats, type DepartmentStats } from "../../api/counselor";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, AlertTriangle, Activity, TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RISK_COLORS: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

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

  if (!stats) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <div className="spinner-lg spinner" />
    </div>
  );

  const pieData = [
    { name: "高风险", value: stats.high_risk_count, color: RISK_COLORS.high },
    { name: "中风险", value: stats.medium_risk_count, color: RISK_COLORS.medium },
    { name: "低风险", value: stats.low_risk_count, color: RISK_COLORS.low },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <div className="page-header">
        <h1>📊 辅导员工作台</h1>
        <p className="subtitle">学生心理健康数据总览和预警监控</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={<Users size={22} />} label="学生总数" value={stats.total_students.toLocaleString()} color="#4f6ef7" bgColor="rgba(79,110,247,0.08)" />
        <StatCard icon={<AlertTriangle size={22} />} label="高风险人数" value={stats.high_risk_count.toLocaleString()} color="#ef4444" bgColor="rgba(239,68,68,0.08)" />
        <StatCard icon={<Activity size={22} />} label="平均压力" value={stats.avg_stress.toFixed(1)} color="#f59e0b" bgColor="rgba(245,158,11,0.08)" />
        <StatCard icon={<TrendingUp size={22} />} label="抑郁率" value={`${stats.depression_rate}%`} color="#8b5cf6" bgColor="rgba(139,92,246,0.08)" />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="chart-card">
          <h3 style={{ marginBottom: 16 }}>风险分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={105} dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3 style={{ marginBottom: 16 }}>各院系抑郁率</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="department" fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
                }}
              />
              <Bar dataKey="depression_rate" fill="#4f6ef7" name="抑郁率 (%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 20px", borderBottom: "1px solid var(--border-light)",
        }}>
          <h3 style={{ margin: 0 }}>🚨 近期高风险预警</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/counselor/alerts")}
          >
            查看全部 <ArrowRight size={14} />
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              {["学号", "姓名", "院系", "概率", "日期"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a: any) => (
              <tr key={a.student_id} style={{ cursor: "pointer" }} onClick={() => navigate(`/counselor/students/${a.student_id}`)}>
                <td style={{ fontWeight: 500 }}>{a.student_id}</td>
                <td>{a.name}</td>
                <td>{a.department}</td>
                <td style={{ color: "var(--danger)", fontWeight: 600 }}>{(a.depression_probability * 100).toFixed(1)}%</td>
                <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{a.assessment_date}</td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state" style={{ padding: 40 }}>暂无预警</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
