import { useEffect, useState } from "react";
import { getAssessments, type AssessmentLatest } from "../../api/student";

const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function AssessmentHistory() {
  const [items, setItems] = useState<AssessmentLatest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    getAssessments(page).then((res) => {
      setItems(res.items);
      setTotalPages(res.total_pages);
    });
  }, [page]);

  const riskBadge = (level: string) => {
    const colors: Record<string, string> = { high: "#e94560", medium: "#f0ad4e", low: "#22c55e" };
    return (
      <span style={{
        background: colors[level] + "20", color: colors[level], padding: "2px 10px",
        borderRadius: 12, fontSize: 12, fontWeight: 600,
      }}>
        {RISK_LABELS[level] || level}
      </span>
    );
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>评估记录</h1>
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["日期", "预测结果", "概率", "风险等级", "干预建议"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((a: any) => (
              <tr key={a.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px" }}>{a.assessment_date}</td>
                <td style={{ padding: "12px 16px", color: a.depression_predicted ? "#e94560" : "#22c55e", fontWeight: 600 }}>
                  {a.depression_predicted ? "是" : "否"}
                </td>
                <td style={{ padding: "12px 16px" }}>{(a.depression_probability * 100).toFixed(1)}%</td>
                <td style={{ padding: "12px 16px" }}>{riskBadge(a.risk_level)}</td>
                <td style={{ padding: "12px 16px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.intervention_text?.substring(0, 60) || "—"}
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
