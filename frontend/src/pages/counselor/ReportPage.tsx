import { useEffect, useState } from "react";
import { getReports, submitReport, type CounselorReportItem } from "../../api/counselor";
import { ChevronLeft, ChevronRight, Send, FileText } from "lucide-react";

function currentWeek(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function ReportPage() {
  const [reports, setReports] = useState<CounselorReportItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  // 表单
  const [week, setWeek] = useState(currentWeek());
  const [overallStatus, setOverallStatus] = useState("");
  const [abnormalCases, setAbnormalCases] = useState("");
  const [keyStudents, setKeyStudents] = useState("");

  const loadReports = () => {
    getReports(page, 10).then((res) => {
      setReports(res.items);
      setTotalPages(res.total_pages);
    });
  };

  useEffect(() => { loadReports(); }, [page]);

  const handleSubmit = async () => {
    if (!overallStatus.trim()) return;
    setSubmitting(true);
    setSuccess("");
    try {
      await submitReport({
        overall_status: overallStatus,
        abnormal_cases: abnormalCases,
        key_students: keyStudents,
        report_week: week,
      });
      setSuccess("汇报提交成功！");
      setOverallStatus("");
      setAbnormalCases("");
      setKeyStudents("");
      loadReports();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>📝 定期上报</h1>
        <p className="subtitle">每周汇报本院系学生整体心理状态</p>
      </div>

      {/* 提交表单 */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Send size={18} /> 提交本周汇报
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-muted)" }}>汇报周次</label>
            <input
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="input"
              placeholder="如 2026-W25"
            />
          </div>
          <div />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-muted)" }}>
            整体心理状态 <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            value={overallStatus}
            onChange={(e) => setOverallStatus(e.target.value)}
            className="input"
            rows={4}
            placeholder="描述本院系学生本周的整体心理状态，如：情绪普遍稳定，期中考试期间部分学生压力有所上升..."
            style={{ resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-muted)" }}>异常情况</label>
          <textarea
            value={abnormalCases}
            onChange={(e) => setAbnormalCases(e.target.value)}
            className="input"
            rows={3}
            placeholder="如有异常情况请描述，如：发现2名学生连续缺课，已进行约谈..."
            style={{ resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-muted)" }}>重点关注学生</label>
          <textarea
            value={keyStudents}
            onChange={(e) => setKeyStudents(e.target.value)}
            className="input"
            rows={2}
            placeholder="需要持续关注的学生情况，如：学号10023近期情绪波动较大，已安排每周谈话..."
            style={{ resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !overallStatus.trim()}>
            {submitting ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                提交中...
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Send size={14} /> 提交汇报
              </span>
            )}
          </button>
          {success && <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 500 }}>{success}</span>}
        </div>
      </div>

      {/* 历史记录 */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={18} />
          <h3 style={{ margin: 0 }}>历史汇报记录</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              {["周次", "整体状态", "异常情况", "重点关注", "提交时间"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td><span className="badge badge-warning">{r.report_week}</span></td>
                <td style={{ maxWidth: 300, whiteSpace: "pre-wrap" }}>{r.overall_status}</td>
                <td style={{ maxWidth: 200, whiteSpace: "pre-wrap", color: r.abnormal_cases ? "var(--text)" : "var(--text-muted)" }}>
                  {r.abnormal_cases || "无"}
                </td>
                <td style={{ maxWidth: 200, whiteSpace: "pre-wrap", color: r.key_students ? "var(--text)" : "var(--text-muted)" }}>
                  {r.key_students || "无"}
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {r.created_at ? new Date(r.created_at).toLocaleString("zh-CN") : "—"}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state" style={{ padding: 50 }}>
                  <div className="icon">📋</div>
                  <p>暂无汇报记录</p>
                </td>
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
