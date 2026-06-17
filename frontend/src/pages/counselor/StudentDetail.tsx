import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStudentDetail, getStudentBehavior, getStudentAssessments, triggerAssessment, updateNotes, type StudentDetail as SD } from "../../api/counselor";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, ClipboardCheck, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const RISK_BADGE: Record<string, string> = { high: "danger", medium: "warning", low: "success" };

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SD | null>(null);
  const [behaviors, setBehaviors] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [tab, setTab] = useState<"behavior" | "assessment">("behavior");
  const [notes, setNotes] = useState("");
  const [assessing, setAssessing] = useState(false);

  const loadData = () => {
    if (!id) return;
    getStudentDetail(id).then(setDetail);
    getStudentBehavior(id).then((r) => setBehaviors(r.items));
    getStudentAssessments(id).then((r) => setAssessments(r.items));
  };

  useEffect(() => { loadData(); }, [id]);

  const handleAssess = async () => {
    if (!id) return;
    setAssessing(true);
    await triggerAssessment(id);
    setAssessing(false);
    loadData();
  };

  const handleNotes = async () => {
    if (!id) return;
    await updateNotes(id, notes);
    setNotes("");
    loadData();
  };

  if (!detail) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <div className="spinner-lg spinner" />
    </div>
  );

  const { profile: p, latest_behavior: b, latest_assessment: a } = detail;
  const riskColor = !a ? "var(--text-muted)" : a.risk_level === "high" ? "#ef4444" : a.risk_level === "medium" ? "#f59e0b" : "#22c55e";

  return (
    <div>
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/counselor/students")} style={{ padding: "6px 10px" }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1>{p.name}</h1>
          <p className="subtitle">学号：{p.student_id}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
        {/* Left: Profile */}
        <div className="card" style={{ padding: 24, alignSelf: "start" }}>
          <h3 style={{ marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>基本信息</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {[["学号", p.student_id], ["年龄", p.age], ["性别", p.gender], ["院系", p.department], ["学分绩点", p.cgpa.toFixed(2)]].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{k}</span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </div>

          {b && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
              <h4 style={{ marginBottom: 12, color: "var(--text-secondary)" }}>最近行为数据</h4>
              {[["😴 睡眠", `${b.sleep_duration}h`], ["📚 学习", `${b.study_hours}h`], ["📱 社交媒体", `${b.social_media_hours}h`], ["🏃 运动", `${b.physical_activity}min`], ["😰 压力", `${b.stress_level}/10`]].map(([k, v]) => (
                <div key={k as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{k}</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {a && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
              <h4 style={{ marginBottom: 12, color: "var(--text-secondary)" }}>风险评估</h4>
              <div style={{ textAlign: "center", padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)" }}>
                <p style={{ fontSize: 32, fontWeight: 700, color: riskColor }}>{(a.depression_probability * 100).toFixed(0)}%</p>
                <span className={`badge badge-${RISK_BADGE[a.risk_level] || "primary"}`} style={{ marginTop: 8 }}>
                  {RISK_LABELS[a.risk_level] || a.risk_level} 风险
                </span>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleAssess}
            disabled={assessing}
            style={{ width: "100%", marginTop: 20, padding: "11px 0" }}
          >
            {assessing ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                评估中...
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardCheck size={16} />
                触发评估
              </span>
            )}
          </button>

          {a && (
            <div style={{ marginTop: 16 }}>
              <textarea
                placeholder="添加管理员备注..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                style={{ height: 80, resize: "vertical" }}
              />
              <button className="btn btn-primary" onClick={handleNotes} style={{ width: "100%", marginTop: 8, padding: "10px 0" }}>
                <Save size={14} /> 保存备注
              </button>
            </div>
          )}
        </div>

        {/* Right: Tabs */}
        <div>
          <div style={{ display: "flex", gap: 0, marginBottom: 0 }}>
            {(["behavior", "assessment"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "11px 28px", border: "none", cursor: "pointer",
                background: tab === t ? "var(--bg-card)" : "var(--bg-page)",
                color: tab === t ? "var(--primary)" : "var(--text-secondary)",
                fontWeight: tab === t ? 600 : 400,
                fontSize: 13,
                borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                transition: "all var(--transition-fast)",
              }}>
                {t === "behavior" ? "📊 行为记录" : "📋 评估记录"}
              </button>
            ))}
          </div>

          <div className="card" style={{ borderRadius: "0 var(--radius-lg) var(--radius-lg) var(--radius-lg)", padding: 24 }}>
            {tab === "behavior" ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={behaviors.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="record_date" fontSize={11} stroke="var(--text-muted)" />
                    <YAxis fontSize={11} stroke="var(--text-muted)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)",
                      }}
                    />
                    <Line type="monotone" dataKey="stress_level" stroke="#ef4444" name="压力" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="sleep_duration" stroke="#4f6ef7" name="睡眠" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ overflowX: "auto", marginTop: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {["日期", "睡眠", "学习", "社交媒体", "运动", "压力"].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {behaviors.map((b: any) => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 500 }}>{b.record_date}</td>
                          <td>{b.sleep_duration}</td>
                          <td>{b.study_hours}</td>
                          <td>{b.social_media_hours}</td>
                          <td>{b.physical_activity}</td>
                          <td style={{ color: b.stress_level >= 8 ? "var(--danger)" : "var(--text-primary)", fontWeight: b.stress_level >= 8 ? 600 : 400 }}>
                            {b.stress_level}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {["日期", "预测", "概率", "风险", "干预"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((a: any) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.assessment_date}</td>
                        <td style={{ color: a.depression_predicted ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                          {a.depression_predicted ? "是" : "否"}
                        </td>
                        <td>{(a.depression_probability * 100).toFixed(1)}%</td>
                        <td>
                          <span className={`badge badge-${RISK_BADGE[a.risk_level] || "primary"}`}>
                            {RISK_LABELS[a.risk_level] || a.risk_level}
                          </span>
                        </td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                          {a.intervention_text?.substring(0, 60) || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
