import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAlerts } from "../../api/counselor";

const DEPARTMENTS = ["", "理学", "工学", "医学", "商学", "艺术"];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [department, setDepartment] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getAlerts(page, 20, department).then((res) => {
      setAlerts(res.items);
      setTotalPages(res.total_pages);
    });
  }, [page, department]);

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>🚨 高风险预警</h1>

      <div style={{ marginBottom: 20 }}>
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14 }}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d || "全部院系"}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fef2f2", textAlign: "left" }}>
              {["学号", "姓名", "院系", "性别", "概率", "风险", "日期"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a: any) => (
              <tr key={a.student_id} style={{ borderTop: "1px solid #eee", cursor: "pointer", background: "#fef2f2" }} onClick={() => navigate(`/counselor/students/${a.student_id}`)}>
                <td style={{ padding: "12px 16px", fontWeight: 500 }}>{a.student_id}</td>
                <td style={{ padding: "12px 16px" }}>{a.name}</td>
                <td style={{ padding: "12px 16px" }}>{a.department}</td>
                <td style={{ padding: "12px 16px" }}>{a.gender}</td>
                <td style={{ padding: "12px 16px", color: "#e94560", fontWeight: 600 }}>
                  {(a.depression_probability * 100).toFixed(1)}%
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ background: "#e9456020", color: "#e94560", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                    高
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "#888", fontSize: 13 }}>{a.assessment_date}</td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#999" }}>
                  ✅ 暂无高风险预警。请从学生详情页触发评估以生成风险数据。
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

const btnStyle: React.CSSProperties = { padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" };
