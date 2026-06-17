import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStudents, type StudentListItem } from "../../api/counselor";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const GENDERS = ["", "Male", "Female"];
const GENDER_LABELS: Record<string, string> = { Male: "男", Female: "女" };
const RISK_LEVELS = ["", "high", "medium", "low"];
const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const RISK_BADGE: Record<string, string> = { high: "danger", medium: "warning", low: "success" };

export default function StudentList() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const params: Record<string, any> = { page, page_size: 20 };
    if (search) params.search = search;
    if (gender) params.gender = gender;
    if (riskLevel) params.risk_level = riskLevel;
    getStudents(params).then((res) => {
      setStudents(res.items);
      setTotalPages(res.total_pages);
    });
  }, [page, search, gender, riskLevel]);

  return (
    <div>
      <div className="page-header">
        <h1>👥 学生管理</h1>
        <p className="subtitle">查看和管理所有学生信息</p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 240 }}>
          <Search size={16} style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }} />
          <input
            placeholder="搜索学号或姓名..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input"
            style={{ paddingLeft: 40 }}
          />
        </div>
        <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }} className="select" style={{ width: 140 }}>
          {GENDERS.map((g) => <option key={g} value={g}>{g ? (GENDER_LABELS[g] || g) : "全部性别"}</option>)}
        </select>
        <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }} className="select" style={{ width: 140 }}>
          {RISK_LEVELS.map((r) => <option key={r} value={r}>{r ? (RISK_LABELS[r] || r) : "全部风险"}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              {["学号", "姓名", "年龄", "性别", "院系", "学分绩点", "风险等级"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.student_id} style={{ cursor: "pointer" }} onClick={() => navigate(`/counselor/students/${s.student_id}`)}>
                <td style={{ fontWeight: 500 }}>{s.student_id}</td>
                <td>{s.name}</td>
                <td>{s.age}</td>
                <td>{s.gender}</td>
                <td>{s.department}</td>
                <td>{s.cgpa.toFixed(2)}</td>
                <td>
                  {s.risk_level ? (
                    <span className={`badge badge-${RISK_BADGE[s.risk_level] || "primary"}`}>
                      {RISK_LABELS[s.risk_level] || s.risk_level}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state" style={{ padding: 40 }}>暂无学生数据</td>
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
