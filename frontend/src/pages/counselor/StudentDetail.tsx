import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStudentDetail, getStudentBehavior, getStudentAssessments, triggerAssessment, updateNotes, type StudentDetail as SD } from "../../api/counselor";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const RISK_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
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

  if (!detail) return <p>加载中...</p>;
  const { profile: p, latest_behavior: b, latest_assessment: a } = detail;

  const riskColor = !a ? "#999" : a.risk_level === "high" ? "#e94560" : a.risk_level === "medium" ? "#f0ad4e" : "#22c55e";

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>学生详情：{p.name} ({p.student_id})</h1>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
        {/* Left: Profile */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", alignSelf: "start" }}>
          <h3 style={{ marginBottom: 16 }}>基本信息</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {[["学号", p.student_id], ["年龄", p.age], ["性别", p.gender], ["院系", p.department], ["学分绩点", p.cgpa.toFixed(2)]].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {b && (
            <div style={{ marginTop: 20, borderTop: "1px solid #eee", paddingTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>最近行为数据</h4>
              {[["睡眠", `${b.sleep_duration}h`], ["学习", `${b.study_hours}h`], ["社交媒体", `${b.social_media_hours}h`], ["运动", `${b.physical_activity}min`], ["压力", `${b.stress_level}/10`]].map(([k, v]) => (
                <div key={k as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#888", fontSize: 13 }}>{k}</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {a && (
            <div style={{ marginTop: 20, borderTop: "1px solid #eee", paddingTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>风险评估</h4>
              <p style={{ fontSize: 24, fontWeight: 700, color: riskColor }}>{(a.depression_probability * 100).toFixed(0)}%</p>
              <p style={{ color: riskColor, fontWeight: 600 }}>{RISK_LABELS[a.risk_level] || a.risk_level} 风险</p>
            </div>
          )}

          <button onClick={handleAssess} disabled={assessing} style={{ width: "100%", marginTop: 20, padding: 10, background: "#e94560", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            {assessing ? "评估中..." : "触发评估"}
          </button>

          {a && (
            <div style={{ marginTop: 16 }}>
              <textarea
                placeholder="添加辅导员备注..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: "100%", height: 80, padding: 8, border: "1px solid #ddd", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
              <button onClick={handleNotes} style={{ width: "100%", marginTop: 8, padding: 8, background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                保存备注
              </button>
            </div>
          )}
        </div>

        {/* Right: Tabs */}
        <div>
          <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
            {(["behavior", "assessment"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "10px 24px", border: "none", cursor: "pointer",
                background: tab === t ? "#1a1a2e" : "#fff",
                color: tab === t ? "#fff" : "#333",
                borderRadius: tab === t ? "8px 8px 0 0" : "8px 8px 0 0",
                fontWeight: tab === t ? 600 : 400,
              }}>
                {t === "behavior" ? "行为记录" : "评估记录"}
              </button>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: "0 12px 12px 12px", padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            {tab === "behavior" ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={behaviors.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="record_date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="stress_level" stroke="#e94560" name="压力" strokeWidth={2} />
                    <Line type="monotone" dataKey="sleep_duration" stroke="#3b82f6" name="睡眠" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                      {["日期", "睡眠", "学习", "社交媒体", "运动", "压力"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", fontSize: 12, color: "#666" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {behaviors.map((b: any) => (
                      <tr key={b.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{b.record_date}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{b.sleep_duration}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{b.study_hours}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{b.social_media_hours}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{b.physical_activity}</td>
                        <td style={{ padding: "8px 12px", fontSize: 13, color: b.stress_level >= 8 ? "#e94560" : "#333", fontWeight: b.stress_level >= 8 ? 600 : 400 }}>{b.stress_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                    {["日期", "预测", "概率", "风险", "干预"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", fontSize: 12, color: "#666" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a: any) => (
                    <tr key={a.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>{a.assessment_date}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: a.depression_predicted ? "#e94560" : "#22c55e" }}>{a.depression_predicted ? "是" : "否"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>{(a.depression_probability * 100).toFixed(1)}%</td>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>{RISK_LABELS[a.risk_level] || a.risk_level}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.intervention_text?.substring(0, 60) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
