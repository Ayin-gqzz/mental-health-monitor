import { useEffect, useState } from "react";
import { getBehaviorHistory, getBehaviorTrend, type BehaviorLatest } from "../../api/student";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
      <h1 style={{ marginBottom: 24 }}>行为记录</h1>

      {trend.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>个人趋势（12周）</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avg_stress" stroke="#e94560" name="平均压力" strokeWidth={2} />
              <Line type="monotone" dataKey="avg_sleep" stroke="#3b82f6" name="平均睡眠(h)" strokeWidth={2} />
              <Line type="monotone" dataKey="avg_study" stroke="#8b5cf6" name="平均学习(h)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["日期", "睡眠(h)", "学习(h)", "社交媒体(h)", "运动(min)", "压力"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((b: any) => (
              <tr key={b.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px" }}>{b.record_date}</td>
                <td style={{ padding: "12px 16px" }}>{b.sleep_duration}</td>
                <td style={{ padding: "12px 16px" }}>{b.study_hours}</td>
                <td style={{ padding: "12px 16px" }}>{b.social_media_hours}</td>
                <td style={{ padding: "12px 16px" }}>{b.physical_activity}</td>
                <td style={{ padding: "12px 16px", color: b.stress_level >= 8 ? "#e94560" : "#333", fontWeight: b.stress_level >= 8 ? 600 : 400 }}>
                  {b.stress_level}/10
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={btnStyle}>上一页</button>
        <span style={{ lineHeight: "36px" }}>第 {page} / {totalPages} 页</span>
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={btnStyle}>下一页</button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer",
};
