import { useEffect, useState } from "react";
import { getOverviewStats, getDepartmentStats, getLatestReports, type OverviewStats, type DepartmentStats, type CounselorReportItem } from "../../api/counselor";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, AlertTriangle, Activity, TrendingUp, FileText } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

const RISK_COLORS: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const BAR_DEFAULT = "#4f6ef7";
const BAR_HIGHLIGHT = "#f59e0b";

export default function CounselorDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [deptStats, setDeptStats] = useState<DepartmentStats[]>([]);
  const [latestReports, setLatestReports] = useState<CounselorReportItem[]>([]);
  const myDept = useAuthStore((s) => s.department);

  useEffect(() => {
    getOverviewStats().then(setStats);
    getDepartmentStats().then(setDeptStats);
    getLatestReports().then(setLatestReports).catch(() => {});
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
        <h1>📊 管理员工作台</h1>
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
              <Bar dataKey="depression_rate" name="抑郁率 (%)" radius={[6, 6, 0, 0]}>
                {deptStats.map((d) => (
                  <Cell key={d.department} fill={d.department === myDept ? BAR_HIGHLIGHT : BAR_DEFAULT} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 各学院辅导员汇报 */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "18px 20px", borderBottom: "1px solid var(--border-light)",
        }}>
          <FileText size={18} />
          <h3 style={{ margin: 0 }}>各学院工作汇报</h3>
        </div>
        {latestReports.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, padding: 20 }}>
            {latestReports.map((r) => (
              <div key={r.id} style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 16,
                background: r.department === myDept ? "rgba(245,158,11,0.04)" : "var(--bg-card)",
                borderColor: r.department === myDept ? "rgba(245,158,11,0.3)" : "var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.department}</span>
                  <span className="badge badge-warning" style={{ fontSize: 11 }}>{r.report_week}</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 8px", whiteSpace: "pre-wrap" }}>
                  {r.overall_status}
                </p>
                {r.abnormal_cases && (
                  <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 6px" }}>
                    ⚠️ {r.abnormal_cases}
                  </p>
                )}
                {r.key_students && (
                  <p style={{ fontSize: 12, color: "var(--warning)", margin: "0 0 6px" }}>
                    👁️ {r.key_students}
                  </p>
                )}
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, textAlign: "right" }}>
                  {r.counselor_name} · {r.created_at ? new Date(r.created_at).toLocaleDateString("zh-CN") : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 40, textAlign: "center" }}>
            <p>暂无工作汇报</p>
          </div>
        )}
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
