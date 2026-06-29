import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWeeklyAssessments, type WeeklyAssessment } from "../../api/student";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";

const COLORS = ["", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981"];
const DIM_NAMES = ["情绪", "睡眠", "学习", "社交", "满意度"];

export default function WeeklyAssessmentHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WeeklyAssessment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = (p: number) => {
    setLoading(true);
    setError(false);
    getWeeklyAssessments(p)
      .then((res) => {
        setItems(res.items);
        setTotalPages(res.total_pages);
      })
      .catch(() => {
        setError(true);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page); }, [page]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 100 }}>
        <div className="spinner-lg spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
        <h2>无法加载数据</h2>
        <p style={{ color: "#64748b", marginBottom: 16 }}>请确认后端已启动并刷新页面</p>
        <button className="btn btn-primary" onClick={() => load(page)}>重试</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>📊 测评记录</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>查看每周心理测评历史</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/student/weekly-assessment")}>
          <Plus size={14} /> 去测评
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center" }}>
          <p style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📝</p>
          <p style={{ color: "#94a3b8", marginBottom: 16 }}>暂无测评记录</p>
          <button className="btn btn-primary" onClick={() => navigate("/student/weekly-assessment")}>去测评</button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {items.map((item) => {
            const color = COLORS[Math.round(item.overall_score)] || "#94a3b8";
            const dims = [item.mood_score, item.sleep_quality, item.study_state, item.social_state, item.life_satisfaction];
            return (
              <div key={item.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                    background: `conic-gradient(${color} ${item.overall_score / 5 * 360}deg, #f1f5f9 0)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", background: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color }}>{item.overall_score.toFixed(1)}</span>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>综合评分 {item.overall_score.toFixed(1)} / 5.0</p>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{item.submit_date}</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
                  {DIM_NAMES.map((name, i) => (
                    <div key={name} style={{ textAlign: "center", padding: "6px 0", background: "#f8fafc", borderRadius: 6 }}>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{name}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: COLORS[dims[i]], margin: "2px 0 0" }}>{dims[i]}</p>
                    </div>
                  ))}
                </div>

                {item.message && (
                  <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 13, color: "#475569" }}>
                    💬 {item.message}
                  </div>
                )}

                {item.ai_reply && (
                  <div style={{ padding: 12, background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", borderRadius: 8, fontSize: 13, color: "#5b21b6", marginTop: 8, border: "1px solid #ddd6fe" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 12 }}>
                      <Sparkles size={14} /> AI 心理助手
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{item.ai_reply}</div>
                  </div>
                )}

                {item.counselor_reply && (
                  <div style={{ padding: 12, background: "#eef2ff", borderRadius: 8, fontSize: 13, color: "#4f6ef7", marginTop: 8 }}>
                    👨‍🏫 辅导员回复：{item.counselor_reply}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            <ChevronLeft size={14} /> 上一页
          </button>
          <span className="page-info">第 {page} / {totalPages} 页</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
            下一页 <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
