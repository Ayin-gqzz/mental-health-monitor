import { useEffect, useState } from "react";
import { getDepartmentStats, getTrends, getComplexQuery, getStressDistribution, type DepartmentStats, type ComplexQueryResult } from "../../api/counselor";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Play } from "lucide-react";

export default function StatisticsPage() {
  const [deptStats, setDeptStats] = useState<DepartmentStats[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [queryResult, setQueryResult] = useState<ComplexQueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [stressDist, setStressDist] = useState<any[]>([]);

  useEffect(() => {
    getDepartmentStats().then(setDeptStats);
    getTrends().then(setTrends);
    getStressDistribution().then(setStressDist);
  }, []);

  const runQuery = async () => {
    setQueryLoading(true);
    const res = await getComplexQuery();
    setQueryResult(res);
    setQueryLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>📈 统计分析</h1>
        <p className="subtitle">学生心理健康数据的多维度统计分析</p>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="chart-card">
          <h3 style={{ marginBottom: 16 }}>各院系抑郁率</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="department" fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)" }} />
              <Bar dataKey="depression_rate" fill="#4f6ef7" name="抑郁率 (%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3 style={{ marginBottom: 16 }}>周趋势（12周）</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)" }} />
              <Legend />
              <Line type="monotone" dataKey="avg_stress" stroke="#ef4444" name="平均压力" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="depression_count" stroke="#8b5cf6" name="抑郁人数" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stress Distribution */}
      {stressDist.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>压力水平分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stressDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="stress_level" fontSize={11} stroke="var(--text-muted)" label={{ value: "压力等级", position: "insideBottom", offset: -5 }} />
              <YAxis fontSize={11} stroke="var(--text-muted)" label={{ value: "学生人数", angle: -90, position: "insideLeft" }} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)" }} />
              <Bar dataKey="count" fill="#6366f1" name="学生人数" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Department Overview Table */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-light)" }}>
          <h3 style={{ margin: 0 }}>院系总览</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              {["院系", "学生数", "平均压力", "平均绩点", "抑郁率", "高风险数"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deptStats.map((d) => (
              <tr key={d.department}>
                <td style={{ fontWeight: 500 }}>{d.department}</td>
                <td>{d.student_count}</td>
                <td>{d.avg_stress}</td>
                <td>{d.avg_cgpa}</td>
                <td style={{ color: d.depression_rate > 10 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>{d.depression_rate}%</td>
                <td style={{ color: d.high_risk_count > 0 ? "var(--danger)" : "var(--text-muted)" }}>{d.high_risk_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SQL Query Demo */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 8 }}>⚡ SQL 查询优化演示</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
          对比慢查询（关联子查询）与优化查询（CTE + ROW_NUMBER + 覆盖索引）的性能差异。
        </p>
        <button className="btn btn-primary" onClick={runQuery} disabled={queryLoading}>
          {queryLoading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
              运行中...
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Play size={14} /> 运行对比
            </span>
          )}
        </button>

        {queryResult && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ textAlign: "center", padding: 20, background: "var(--danger-light)", borderRadius: "var(--radius-md)" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>慢查询</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: "var(--danger)" }}>{queryResult.slow_query_ms}ms</p>
              </div>
              <div style={{ textAlign: "center", padding: 20, background: "var(--success-light)", borderRadius: "var(--radius-md)" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>优化查询</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: "var(--success)" }}>{queryResult.optimized_query_ms}ms</p>
              </div>
              <div style={{ textAlign: "center", padding: 20, background: queryResult.improvement_pct >= 30 ? "var(--success-light)" : "var(--danger-light)", borderRadius: "var(--radius-md)" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>优化幅度</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: queryResult.improvement_pct >= 30 ? "var(--success)" : "var(--danger)" }}>
                  {queryResult.improvement_pct}%
                </p>
              </div>
            </div>

            <h4 style={{ marginBottom: 12 }}>查询结果</h4>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {["院系", "学生数", "平均压力", "平均睡眠", "高风险数"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.data.map((r: any) => (
                    <tr key={r.department}>
                      <td style={{ fontWeight: 500 }}>{r.department}</td>
                      <td>{r.total_students}</td>
                      <td>{r.avg_stress}</td>
                      <td>{r.avg_sleep}</td>
                      <td>{r.high_risk_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
