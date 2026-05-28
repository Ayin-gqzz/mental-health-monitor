import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAlerts, markAsRead, markAllAsRead, type NotificationItem } from "../../api/counselor";

const DEPARTMENTS = ["", "理学", "工学", "医学", "商学", "艺术"];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [department, setDepartment] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const navigate = useNavigate();

  const loadAlerts = () => {
    getAlerts(page, 20, department, readFilter).then((res) => {
      setAlerts(res.items);
      setTotalPages(res.total_pages);
    });
  };

  useEffect(() => { loadAlerts(); }, [page, department, readFilter]);

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
        <h1 style={{ margin: 0 }}>高风险预警</h1>
        <button onClick={handleMarkAllRead} style={{ padding: "8px 16px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          全部标为已读
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} style={selectStyle}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d || "全部院系"}</option>)}
        </select>
        <select value={readFilter} onChange={(e) => { setReadFilter(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">全部状态</option>
          <option value="false">未读</option>
          <option value="true">已读</option>
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fef2f2", textAlign: "left" }}>
              {["状态", "学号", "姓名", "院系", "性别", "概率", "风险", "日期", "操作"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr
                key={a.id}
                style={{
                  borderTop: "1px solid #eee",
                  cursor: "pointer",
                  background: a.is_read ? "#fff" : "#fef2f2",
                }}
                onClick={() => navigate(`/counselor/students/${a.student_id}`)}
              >
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                    background: a.is_read ? "#ccc" : "#e94560",
                  }} />
                </td>
                <td style={{ padding: "12px 16px", fontWeight: 500 }}>{a.student_id}</td>
                <td style={{ padding: "12px 16px" }}>{a.name}</td>
                <td style={{ padding: "12px 16px" }}>{a.department}</td>
                <td style={{ padding: "12px 16px" }}>{a.gender}</td>
                <td style={{ padding: "12px 16px", color: "#e94560", fontWeight: 600 }}>
                  {a.depression_probability ? (a.depression_probability * 100).toFixed(1) + "%" : "—"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: "#e9456020", color: "#e94560", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                    高
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "#888", fontSize: 13 }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString("zh-CN") : "—"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {!a.is_read && (
                    <button
                      onClick={(e) => handleMarkRead(a.id, e)}
                      style={{ padding: "4px 10px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                    >
                      标为已读
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                  暂无高风险预警。请从学生详情页触发评估以生成风险数据。
                </td>
              </tr>
            )}
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

const selectStyle: React.CSSProperties = { padding: "8px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14 };
const btnStyle: React.CSSProperties = { padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" };
