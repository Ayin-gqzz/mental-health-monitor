import { useEffect, useState } from "react";
import { getWeeklyAssessments, type WeeklyAssessment } from "../../api/student";
import { ChevronLeft, ChevronRight, MessageSquare, AlertCircle } from "lucide-react";

const SCORE_COLORS = ["", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#10b981"];

export default function WeeklyAssessmentHistory() {
  const [items, setItems] = useState<WeeklyAssessment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    setLoading(true);
    getWeeklyAssessments(page)
      .then((res) => {
        setItems(res.items);
        setTotalPages(res.total_pages);
        setApiError(false);
      })
      .catch(() => {
        setItems([]);
        setTotalPages(1);
        setApiError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page]);

  const getOverallColor = (score: number) => {
    if (score >= 4) return "#22c55e";
    if (score >= 3) return "#f59e0b";
    if (score >= 2) return "#f97316";
    return "#ef4444";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner-lg spinner" />
      </div>
    );
  }

  // 如果后端表不存在，显示提示
  if (apiError) {
    return (
      <div>
        <div className="page-header">
          <h1>📊 测评记录</h1>
          <p className="subtitle">查看您的每周心理测评历史记录</p>
        </div>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <AlertCircle size={48} style={{ color: "var(--warning)", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>后端服务未就绪</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            请先重启后端服务以创建必要的数据库表。
          </p>
          <div style={{
            padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)",
            textAlign: "left", fontFamily: "monospace", fontSize: 13, lineHeight: 1.8,
          }}>
            <p style={{ margin: 0, color: "var(--text-muted)" }}># 在终端中执行：</p>
            <p style={{ margin: 0, color: "var(--primary)" }}>cd backend</p>
            <p style={{ margin: 0, color: "var(--primary)" }}>uvicorn app.main:app --host 127.0.0.1 --port 8000</p>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => window.location.reload()}
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>📊 测评记录</h1>
        <p className="subtitle">查看您的每周心理测评历史记录</p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {items.map((item) => (
          <div key={item.id} className="card" style={{ padding: 20 }}>
            {/* 头部 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: `conic-gradient(${getOverallColor(item.overall_score)} ${item.overall_score / 5 * 360}deg, var(--border-light) 0)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    background: "#fff", width: 38, height: 38, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: getOverallColor(item.overall_score) }}>
                      {item.overall_score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>综合评分</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{item.submit_date}</p>
                </div>
              </div>
            </div>

            {/* 评分明细 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { label: "情绪", score: item.mood_score },
                { label: "睡眠", score: item.sleep_quality },
                { label: "学习", score: item.study_state },
                { label: "社交", score: item.social_state },
                { label: "满意度", score: item.life_satisfaction },
              ].map(({ label, score }) => (
                <div key={label} style={{
                  textAlign: "center", padding: "8px 4px",
                  background: "var(--bg-page)", borderRadius: "var(--radius-sm)",
                }}>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: SCORE_COLORS[score], margin: "2px 0 0" }}>{score}</p>
                </div>
              ))}
            </div>

            {/* 留言和回复 */}
            {item.message && (
              <div style={{
                padding: 12, background: "var(--bg-page)", borderRadius: "var(--radius-md)",
                fontSize: 13, color: "var(--text-secondary)", marginBottom: 8,
              }}>
                <p style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  <MessageSquare size={12} /> 留言
                </p>
                {item.message}
              </div>
            )}

            {item.counselor_reply && (
              <div style={{
                padding: 12, background: "var(--primary-light)", borderRadius: "var(--radius-md)",
                fontSize: 13, color: "var(--primary)",
              }}>
                <p style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>👨‍🏫 辅导员回复</p>
                {item.counselor_reply}
              </div>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="card" style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📝</div>
            <p style={{ color: "var(--text-muted)" }}>暂无测评记录</p>
          </div>
        )}
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
