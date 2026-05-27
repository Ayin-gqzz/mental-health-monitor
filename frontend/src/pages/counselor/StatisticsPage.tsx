import { useEffect, useState } from "react";
import { getDepartmentStats, getTrends, getComplexQuery, type DepartmentStats, type ComplexQueryResult } from "../../api/counselor";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function StatisticsPage() {
  const [deptStats, setDeptStats] = useState<DepartmentStats[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [queryResult, setQueryResult] = useState<ComplexQueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  useEffect(() => {
    getDepartmentStats().then(setDeptStats);
    getTrends().then(setTrends);
  }, []);

  const runQuery = async () => {
    setQueryLoading(true);
    const res = await getComplexQuery();
    setQueryResult(res);
    setQueryLoading(false);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>统计分析</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
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
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginBottom: 16 }}>周趋势（12周）</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avg_stress" stroke="#e94560" name="平均压力" strokeWidth={2} />
              <Line type="monotone" dataKey="depression_count" stroke="#8b5cf6" name="抑郁人数" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>院系总览</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["院系", "学生数", "平均压力", "平均绩点", "抑郁率", "高风险数"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deptStats.map((d) => (
              <tr key={d.department} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "10px 16px", fontWeight: 500 }}>{d.department}</td>
                <td style={{ padding: "10px 16px" }}>{d.student_count}</td>
                <td style={{ padding: "10px 16px" }}>{d.avg_stress}</td>
                <td style={{ padding: "10px 16px" }}>{d.avg_cgpa}</td>
                <td style={{ padding: "10px 16px", color: d.depression_rate > 10 ? "#e94560" : "#22c55e" }}>{d.depression_rate}%</td>
                <td style={{ padding: "10px 16px", color: d.high_risk_count > 0 ? "#e94560" : "#999" }}>{d.high_risk_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <h3 style={{ marginBottom: 16 }}>SQL 查询优化演示</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
          对比慢查询（关联子查询）与优化查询（CTE + ROW_NUMBER + 覆盖索引）。
        </p>
        <button onClick={runQuery} disabled={queryLoading} style={{ padding: "10px 24px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 16 }}>
          {queryLoading ? "运行中..." : "运行对比"}
        </button>

        {queryResult && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ textAlign: "center", padding: 16, background: "#fef2f2", borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: "#888" }}>慢查询</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: "#e94560" }}>{queryResult.slow_query_ms}ms</p>
              </div>
              <div style={{ textAlign: "center", padding: 16, background: "#f0fdf4", borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: "#888" }}>优化查询</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>{queryResult.optimized_query_ms}ms</p>
              </div>
              <div style={{ textAlign: "center", padding: 16, background: queryResult.improvement_pct >= 30 ? "#f0fdf4" : "#fef2f2", borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: "#888" }}>优化幅度</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: queryResult.improvement_pct >= 30 ? "#22c55e" : "#e94560" }}>
                  {queryResult.improvement_pct}%
                </p>
              </div>
            </div>

            <h4 style={{ marginBottom: 8 }}>查询结果</h4>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                  {["院系", "学生数", "平均压力", "平均睡眠", "高风险数"].map((h) => (
                    <th key={h} style={{ padding: "8px 16px", fontSize: 13, color: "#666" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryResult.data.map((r: any) => (
                  <tr key={r.department} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "8px 16px" }}>{r.department}</td>
                    <td style={{ padding: "8px 16px" }}>{r.total_students}</td>
                    <td style={{ padding: "8px 16px" }}>{r.avg_stress}</td>
                    <td style={{ padding: "8px 16px" }}>{r.avg_sleep}</td>
                    <td style={{ padding: "8px 16px" }}>{r.high_risk_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
