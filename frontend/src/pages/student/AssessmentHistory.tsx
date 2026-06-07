import { useEffect, useState } from "react";
import { getAssessments, type AssessmentLatest } from "../../api/student";
import { ChevronLeft, ChevronRight } from "lucide-react";

const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const RISK_COLORS: Record<string, string> = { high: "danger", medium: "warning", low: "success" };

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

  return (
    <div>
      <div className="page-header">
        <h1>📋 评估记录</h1>
        <p className="subtitle">查看历史心理健康评估结果</p>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              {["日期", "预测结果", "概率", "风险等级", "干预建议"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((a: any) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.assessment_date}</td>
                <td>
                  <span style={{
                    color: a.depression_predicted ? "var(--danger)" : "var(--success)",
                    fontWeight: 600,
                  }}>
                    {a.depression_predicted ? "是" : "否"}
                  </span>
                </td>
                <td>{(a.depression_probability * 100).toFixed(1)}%</td>
                <td>
                  <span className={`badge badge-${RISK_COLORS[a.risk_level] || "primary"}`}>
                    {RISK_LABELS[a.risk_level] || a.risk_level}
                  </span>
                </td>
                <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                  {a.intervention_text?.substring(0, 60) || "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state" style={{ padding: 40 }}>暂无评估记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
