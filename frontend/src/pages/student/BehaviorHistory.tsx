import { useEffect, useState } from "react";
import { getBehaviorHistory, getBehaviorTrend, type BehaviorLatest } from "../../api/student";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function BehaviorHistory() {
  const [items, setItems] = useState<BehaviorLatest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [trend, setTrend] = useState<any[]>([]);

  useEffect(() => {
    getBehaviorHistory(page).then((res) => {
      setItems(res.items);
      setTotalPages(res.total_pages);
    });
  }, [page]);

  useEffect(() => {
    getBehaviorTrend().then(setTrend);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>📊 行为记录</h1>
        <p className="subtitle">查看您的日常生活习惯数据和趋势变化</p>
      </div>

      {/* Trend Chart */}
      {trend.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>个人趋势（12周）</h3>
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
              <Legend />
              <Line type="monotone" dataKey="avg_stress" stroke="#ef4444" name="平均压力" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="avg_sleep" stroke="#4f6ef7" name="平均睡眠(h)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="avg_study" stroke="#8b5cf6" name="平均学习(h)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              {["日期", "睡眠(h)", "学习(h)", "社交媒体(h)", "运动(min)", "压力"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((b: any) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 500 }}>{b.record_date}</td>
                <td>{b.sleep_duration}</td>
                <td>{b.study_hours}</td>
                <td>{b.social_media_hours}</td>
                <td>{b.physical_activity}</td>
                <td>
                  <span style={{
                    color: b.stress_level >= 8 ? "var(--danger)" : b.stress_level >= 5 ? "var(--warning)" : "var(--success)",
                    fontWeight: b.stress_level >= 8 ? 600 : 400,
                  }}>
                    {b.stress_level}/10
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state" style={{ padding: 40 }}>暂无行为记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button className="btn btn-ghost btn-sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft size={14} /> 上一页
        </button>
        <span className="page-info">第 {page} / {totalPages} 页</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
          下一页 <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
