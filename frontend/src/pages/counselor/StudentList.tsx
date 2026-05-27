import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStudents, type StudentListItem } from "../../api/counselor";

const DEPARTMENTS = ["", "理学", "工学", "医学", "商学", "艺术"];
const RISK_LEVELS = ["", "high", "medium", "low"];
const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function StudentList() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const params: Record<string, any> = { page, page_size: 20 };
    if (search) params.search = search;
    if (department) params.department = department;
    if (riskLevel) params.risk_level = riskLevel;
    getStudents(params).then((res) => {
      setStudents(res.items);
      setTotalPages(res.total_pages);
    });
  }, [page, search, department, riskLevel]);

  const riskBadge = (level: string | null) => {
    if (!level) return <span style={{ color: "#999" }}>—</span>;
    const colors: Record<string, string> = { high: "#e94560", medium: "#f0ad4e", low: "#22c55e" };
    return (
      <span style={{ background: colors[level] + "20", color: colors[level], padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
        {RISK_LABELS[level] || level}
      </span>
    );
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>学生列表</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="搜索学号或姓名..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, width: 220 }}
        />
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} style={selectStyle}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d || "全部院系"}</option>)}
        </select>
        <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} style={selectStyle}>
          {RISK_LEVELS.map((r) => <option key={r} value={r}>{r ? (RISK_LABELS[r] || r) : "全部风险等级"}</option>)}
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["学号", "姓名", "年龄", "性别", "院系", "学分绩点", "风险等级"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.student_id} style={{ borderTop: "1px solid #eee", cursor: "pointer" }} onClick={() => navigate(`/counselor/students/${s.student_id}`)}>
                <td style={{ padding: "12px 16px", fontWeight: 500 }}>{s.student_id}</td>
                <td style={{ padding: "12px 16px" }}>{s.name}</td>
                <td style={{ padding: "12px 16px" }}>{s.age}</td>
                <td style={{ padding: "12px 16px" }}>{s.gender}</td>
                <td style={{ padding: "12px 16px" }}>{s.department}</td>
                <td style={{ padding: "12px 16px" }}>{s.cgpa.toFixed(2)}</td>
                <td style={{ padding: "12px 16px" }}>{riskBadge(s.risk_level)}</td>
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

const selectStyle: React.CSSProperties = { padding: "8px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14 };
const btnStyle: React.CSSProperties = { padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" };
