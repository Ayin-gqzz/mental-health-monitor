import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAlerts, markAsRead, markAllAsRead, type NotificationItem } from "../../api/counselor";
import { ChevronLeft, ChevronRight, CheckCheck } from "lucide-react";

const GENDERS = ["", "Male", "Female"];
const GENDER_LABELS: Record<string, string> = { Male: "男", Female: "女" };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [gender, setGender] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const navigate = useNavigate();

  const loadAlerts = () => {
    getAlerts(page, 20, "", gender, readFilter).then((res) => {
      setAlerts(res.items);
      setTotalPages(res.total_pages);
    });
  };

  useEffect(() => { loadAlerts(); }, [page, gender, readFilter]);

  const handleMarkRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(id);
    loadAlerts();
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    loadAlerts();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div className="page-header" style={{ margin: 0 }}>
          <h1>🚨 高风险预警</h1>
          <p className="subtitle">需要关注的高风险学生预警信息</p>
        </div>
        <button className="btn btn-primary" onClick={handleMarkAllRead}>
          <CheckCheck size={16} /> 全部标为已读
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }} className="select" style={{ width: 140 }}>
          {GENDERS.map((g) => <option key={g} value={g}>{g ? (GENDER_LABELS[g] || g) : "全部性别"}</option>)}
        </select>
        <select value={readFilter} onChange={(e) => { setReadFilter(e.target.value); setPage(1); }} className="select" style={{ width: 140 }}>
          <option value="">全部状态</option>
          <option value="false">未读</option>
          <option value="true">已读</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              {["状态", "学号", "姓名", "院系", "性别", "概率", "风险", "日期", "操作"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr
                key={a.id}
                style={{
                  cursor: "pointer",
                  background: a.is_read ? "transparent" : "rgba(239,68,68,0.02)",
                }}
                onClick={() => navigate(`/counselor/students/${a.student_id}`)}
              >
                <td>
                  <span style={{
                    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                    background: a.is_read ? "var(--border)" : "var(--danger)",
                    boxShadow: a.is_read ? "none" : "0 0 6px rgba(239,68,68,0.4)",
                  }} />
                </td>
                <td style={{ fontWeight: 500 }}>{a.student_id}</td>
                <td>{a.name}</td>
                <td>{a.department}</td>
                <td>{GENDER_LABELS[a.gender] || a.gender}</td>
                <td style={{ color: "var(--danger)", fontWeight: 600 }}>
                  {a.depression_probability ? (a.depression_probability * 100).toFixed(1) + "%" : "—"}
                </td>
                <td>
                  <span className="badge badge-danger">高</span>
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString("zh-CN") : "—"}
                </td>
                <td>
                  {!a.is_read && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => handleMarkRead(a.id, e)}
                    >
                      标为已读
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-state" style={{ padding: 50 }}>
                  <div className="icon">✅</div>
                  <p>暂无高风险预警</p>
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
