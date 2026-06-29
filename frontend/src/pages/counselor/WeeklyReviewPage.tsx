import { useEffect, useState } from "react";
import {
  getWeeklyAssessments,
  getWeeklyAssessmentDetail,
  replyWeeklyAssessment,
  getWeeklyAssessmentStats,
  type WeeklyAssessmentItem,
  type WeeklyAssessmentDetail,
  type WeeklyAssessmentStats,
} from "../../api/counselor";
import { useAuthStore } from "../../stores/authStore";
import {
  MessageSquare, Send, ChevronLeft, ChevronRight, Brain,
  TrendingUp, TrendingDown, Minus, X, Sparkles,
} from "lucide-react";

const SCORE_COLORS: Record<number, string> = {
  1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#10b981",
};
const SCORE_LABELS: Record<number, string> = {
  1: "很差", 2: "较差", 3: "一般", 4: "较好", 5: "很好",
};
const SENTIMENT_COLORS: Record<string, string> = {
  "积极": "#10b981", "中性": "#6b7280", "消极": "#ef4444",
};

export default function WeeklyReviewPage() {
  const { isAdmin } = useAuthStore();
  const [items, setItems] = useState<WeeklyAssessmentItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<WeeklyAssessmentStats | null>(null);
  const [hasMessage, setHasMessage] = useState("");
  const [sortBy, setSortBy] = useState("sentiment");
  const [selected, setSelected] = useState<WeeklyAssessmentDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyMsg, setReplyMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadList = () => {
    const params: Record<string, any> = { page, page_size: 15, sort_by: sortBy };
    if (hasMessage) params.has_message = hasMessage;
    getWeeklyAssessments(params).then((res) => {
      setItems(res.items);
      setTotalPages(res.total_pages);
    });
  };

  useEffect(() => { loadList(); }, [page, hasMessage, sortBy]);
  useEffect(() => { getWeeklyAssessmentStats().then(setStats); }, []);

  const openDetail = async (id: number) => {
    setLoading(true);
    try {
      const detail = await getWeeklyAssessmentDetail(id);
      setSelected(detail);
      setReplyText(detail.counselor_reply || "");
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    setReplyMsg(null);
    try {
      await replyWeeklyAssessment(selected.id, replyText.trim());
      setSelected({ ...selected, counselor_reply: replyText.trim() });
      setReplyMsg({ type: "success", text: "回复已发送" });
      setTimeout(() => setReplyMsg(null), 2000);
      loadList();
    } catch (err: any) {
      setReplyMsg({ type: "error", text: err?.response?.data?.detail || "发送失败，请重试" });
    } finally {
      setReplying(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="page-header">
        <h1>📋 每周心理测评</h1>
        <p className="subtitle">查看学生提交的每周心理测评，回复留言并进行情感分析</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "总提交", value: stats.total, color: "var(--primary)" },
            { label: "有留言", value: stats.with_message, color: "#8b5cf6" },
            { label: "已回复", value: stats.replied, color: "var(--success)" },
            { label: "待回复", value: stats.unreplied, color: "var(--danger)" },
            { label: "近7天", value: stats.recent_7days, color: "#06b6d4" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 700, color, margin: 0 }}>{value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="select"
          style={{ width: 180 }}
        >
          <option value="sentiment">按情感分排序（消极优先）</option>
          <option value="date">按时间排序（最新优先）</option>
        </select>
        <select
          value={hasMessage}
          onChange={(e) => { setHasMessage(e.target.value); setPage(1); }}
          className="select"
          style={{ width: 160 }}
        >
          <option value="">全部记录</option>
          <option value="true">仅看有留言</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              {["学号", "姓名", "日期", "情绪", "睡眠", "学习", "社交", "生活", "综合", "情感", "状态"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                style={{ cursor: "pointer" }}
                onClick={() => openDetail(item.id)}
              >
                <td style={{ fontWeight: 500 }}>{item.student_id}</td>
                <td>{item.student_name}</td>
                <td>{item.submit_date?.slice(5) || ""}</td>
                {[item.mood_score, item.sleep_quality, item.study_state, item.social_state, item.life_satisfaction].map((score, i) => (
                  <td key={i}>
                    <span style={{ color: SCORE_COLORS[score], fontWeight: 600 }}>{score}</span>
                  </td>
                ))}
                <td style={{ fontWeight: 600, color: SCORE_COLORS[Math.round(item.overall_score)] || "var(--text-primary)" }}>
                  {item.overall_score.toFixed(1)}
                </td>
                <td>
                  {item.sentiment_score != null ? (
                    <span className={`badge badge-${item.sentiment_score < 0.45 ? "danger" : item.sentiment_score > 0.75 ? "success" : ""}`} style={{ fontSize: 11 }}>
                      {item.sentiment_score < 0.45 ? "消极" : item.sentiment_score > 0.75 ? "积极" : "中性"}
                    </span>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td>
                  {item.counselor_reply ? (
                    <span className="badge badge-success" style={{ fontSize: 11 }}>已复</span>
                  ) : item.message ? (
                    <span className="badge badge-warning" style={{ fontSize: 11 }}>待复</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={11} className="empty-state" style={{ padding: 40 }}>暂无测评数据</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button className="btn btn-ghost btn-sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft size={14} /> 上一页
        </button>
        <span className="page-info">第 {page} / {totalPages} 页</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
          下一页 <ChevronRight size={14} />
        </button>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center",
          zIndex: 1000, overflowY: "auto", padding: "40px 20px",
          boxSizing: "border-box" as any,
        }} onClick={() => setSelected(null)}>
          <div
            style={{
              background: "var(--bg-card)", borderRadius: "var(--radius-xl)",
              width: "100%", maxWidth: 800, margin: "0 auto 40px",
              padding: 32, boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
              alignSelf: "flex-start",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {selected.student_name} 的心理测评
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  {selected.student_id} · {selected.department} · {selected.submit_date}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={20} />
              </button>
            </div>

            {/* Scores */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "情绪状态", score: selected.mood_score },
                { label: "睡眠质量", score: selected.sleep_quality },
                { label: "学习状态", score: selected.study_state },
                { label: "社交状态", score: selected.social_state },
                { label: "生活满意度", score: selected.life_satisfaction },
              ].map(({ label, score }) => (
                <div key={label} style={{
                  textAlign: "center", padding: 16,
                  background: `${SCORE_COLORS[score]}15`,
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${SCORE_COLORS[score]}30`,
                }}>
                  <p style={{ fontSize: 32, fontWeight: 700, color: SCORE_COLORS[score], margin: 0 }}>{score}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>{label}</p>
                  <p style={{ fontSize: 10, color: SCORE_COLORS[score], margin: "2px 0 0" }}>{SCORE_LABELS[score]}</p>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginBottom: 24, padding: 12, background: "var(--bg-page)", borderRadius: "var(--radius-md)" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>综合得分：</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: SCORE_COLORS[Math.round(selected.overall_score)] || "var(--text-primary)" }}>
                {selected.overall_score.toFixed(1)}
              </span>
            </div>

            {/* Student Message */}
            {selected.message && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <MessageSquare size={16} /> 学生留言
                </h3>
                <div style={{
                  padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)",
                  fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)",
                }}>
                  {selected.message}
                </div>
              </div>
            )}

            {/* NLP Analysis */}
            {selected.nlp_analysis && !("error" in selected.nlp_analysis) && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Brain size={16} /> NLP 情感分析
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Sentiment */}
                  <div style={{ padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)" }}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>情感倾向</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 60, height: 60, borderRadius: "50%",
                        background: SENTIMENT_COLORS[selected.nlp_analysis.sentiment_label] || "#6b7280",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 20, fontWeight: 700,
                      }}>
                        {selected.nlp_analysis.sentiment_label === "积极" ? <TrendingUp size={24} /> :
                         selected.nlp_analysis.sentiment_label === "消极" ? <TrendingDown size={24} /> :
                         <Minus size={24} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: SENTIMENT_COLORS[selected.nlp_analysis.sentiment_label] }}>
                          {selected.nlp_analysis.sentiment_label}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                          得分: {selected.nlp_analysis.sentiment_score.toFixed(2)} / 1.00
                        </p>
                      </div>
                    </div>
                    {/* Score bar */}
                    <div style={{ marginTop: 12, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${selected.nlp_analysis.sentiment_score * 100}%`,
                        background: SENTIMENT_COLORS[selected.nlp_analysis.sentiment_label] || "#6b7280",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                  </div>

                  {/* Topics */}
                  <div style={{ padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)" }}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>心理主题</p>
                    {Object.entries(selected.nlp_analysis.psychological_topics).length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {Object.entries(selected.nlp_analysis.psychological_topics).slice(0, 4).map(([topic, score]) => (
                          <div key={topic} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, width: 72, flexShrink: 0 }}>{topic}</span>
                            <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: 3,
                                width: `${Math.min(100, (score as number) * 100)}%`,
                                background: "var(--primary)",
                              }} />
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", width: 36, textAlign: "right" }}>
                              {(score as number).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>未检测到明显主题</p>
                    )}
                  </div>

                  {/* Keywords */}
                  <div style={{ padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)", gridColumn: "span 2" }}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>关键词提取</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selected.nlp_analysis.keywords.slice(0, 12).map(([kw, weight]) => (
                        <span key={kw} style={{
                          padding: "4px 10px", borderRadius: 12,
                          background: "var(--primary-light)", color: "var(--primary)",
                          fontSize: 12, fontWeight: 500,
                        }}>
                          {kw} <span style={{ opacity: 0.6 }}>{(weight as number).toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Reply (read-only) */}
            {selected.ai_reply && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6, color: "#7c3aed" }}>
                  <Sparkles size={16} /> AI 心理助手回复
                </h3>
                <div style={{
                  padding: 16, background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                  borderRadius: "var(--radius-md)", fontSize: 14, lineHeight: 1.7,
                  color: "#5b21b6", border: "1px solid #ddd6fe", whiteSpace: "pre-wrap",
                }}>
                  {selected.ai_reply}
                </div>
              </div>
            )}

            {/* Reply Section */}
            <div>
              <h3 style={{ fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Send size={16} /> 管理员回复
              </h3>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="输入回复内容..."
                className="input"
                rows={4}
                style={{ resize: "vertical", width: "100%", marginBottom: 12 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>关闭</button>
                <button
                  className="btn btn-primary"
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                >
                  {replying ? "发送中..." : "发送回复"}
                </button>
              </div>
              {replyMsg && (
                <p style={{
                  margin: "8px 0 0", fontSize: 13, textAlign: "right",
                  color: replyMsg.type === "success" ? "var(--success)" : "var(--danger)",
                }}>
                  {replyMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
