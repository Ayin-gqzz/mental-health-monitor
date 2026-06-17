import { useEffect, useState } from "react";
import { getClusterAnalysis, type ClusterData } from "../../api/counselor";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
  BarChart, Bar,
} from "recharts";
import { AlertCircle } from "lucide-react";

const CLUSTER_COLORS = ["#22c55e", "#4f6ef7", "#f59e0b", "#ef4444"];
const SCATTER_COLORS = ["#22c55e", "#4f6ef7", "#f59e0b", "#ef4444"];

export default function ClusterAnalysisPage() {
  const [data, setData] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getClusterAnalysis()
      .then(setData)
      .catch((err) => setError(err?.response?.data?.detail || "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}>
      <div className="spinner-lg spinner" />
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderRadius: 10, background: "#fef2f2", color: "#ef4444" }}>
        <AlertCircle size={18} /> {error}
      </div>
    </div>
  );

  if (!data) return null;

  const { clusters, scatter, global_means, feature_names } = data;

  // 雷达图数据：每个特征归一化到 0-100 用于对比
  const maxVals: Record<string, number> = {
    stress_level: 10, sleep_duration: 10, study_hours: 12, social_media_hours: 10, physical_activity: 300,
  };
  const radarData = feature_names.map((name, i) => {
    const keys = ["stress_level", "sleep_duration", "study_hours", "social_media_hours", "physical_activity"] as const;
    const key = keys[i];
    const max = maxVals[key];
    const row: any = { dimension: name };
    clusters.forEach((c) => {
      row[c.name] = Math.round((c.features[key] / max) * 100);
    });
    row["全体均值"] = Math.round(((global_means as any)[key] / max) * 100);
    return row;
  });

  // 风险分布柱状图数据
  const riskBarData = clusters.map((c) => ({
    name: c.name.replace(/[🟢🔵🟡🔴]\s*/, ""),
    high: c.risk_distribution.high,
    medium: c.risk_distribution.medium,
    low: c.risk_distribution.low,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>👥 学生群体画像</h1>
        <p className="subtitle">基于 K-Means 聚类分析学生行为模式，共识别 {data.total_students} 名学生</p>
      </div>

      {/* 聚类概览卡片 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {clusters.map((c) => (
          <div key={c.cluster_id} className="stat-card" style={{ borderLeft: `4px solid ${CLUSTER_COLORS[c.cluster_id]}` }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 4px 0" }}>{c.name}</p>
              <p className="stat-value" style={{ color: CLUSTER_COLORS[c.cluster_id], fontSize: 28 }}>
                {c.count}
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>
                  ({c.percentage}%)
                </span>
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                <span>♂{c.gender_ratio.male}</span>
                <span>♀{c.gender_ratio.female}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 散点图 + 雷达图 */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 24 }}>
        {/* PCA 散点图 */}
        <div className="chart-card">
          <h3 style={{ marginBottom: 4 }}>PCA 降维聚类散点图</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            每个点代表一名学生，颜色代表所属群体
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="x" name="PC1" fontSize={11} stroke="var(--text-muted)" />
              <YAxis type="number" dataKey="y" name="PC2" fontSize={11} stroke="var(--text-muted)" />
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", padding: "8px 12px", borderRadius: 8, boxShadow: "var(--shadow-md)", fontSize: 12 }}>
                      <p style={{ margin: 0 }}>{d.student_id}</p>
                      <p style={{ margin: 0, color: SCATTER_COLORS[d.cluster] }}>
                        {clusters[d.cluster]?.name}
                      </p>
                    </div>
                  );
                }}
              />
              {clusters.map((c) => (
                <Scatter
                  key={c.cluster_id}
                  name={c.name}
                  data={scatter.filter((s) => s.cluster === c.cluster_id)}
                  fill={SCATTER_COLORS[c.cluster_id]}
                  opacity={0.6}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
            {clusters.map((c) => (
              <div key={c.cluster_id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: SCATTER_COLORS[c.cluster_id] }} />
                {c.name}
              </div>
            ))}
          </div>
        </div>

        {/* 雷达图 */}
        <div className="chart-card">
          <h3 style={{ marginBottom: 4 }}>群体特征雷达图</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            对比各群体与全体均值的特征差异
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="dimension" fontSize={11} />
              <PolarRadiusAxis fontSize={10} domain={[0, 100]} tick={false} />
              <Radar name="全体均值" dataKey="全体均值" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
              {clusters.map((c) => (
                <Radar key={c.cluster_id} name={c.name} dataKey={c.name}
                  stroke={CLUSTER_COLORS[c.cluster_id]} fill={CLUSTER_COLORS[c.cluster_id]}
                  fillOpacity={0.1} strokeWidth={2} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 群体特征详情 + 风险分布 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* 特征详情表 */}
        <div className="card" style={{ padding: 20, overflow: "hidden" }}>
          <h3 style={{ marginBottom: 16 }}>群体特征对比</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>维度</th>
                  <th>全体均值</th>
                  {clusters.map((c) => (
                    <th key={c.cluster_id} style={{ color: CLUSTER_COLORS[c.cluster_id] }}>
                      {c.name.replace(/[🟢🔵🟡🔴]\s*/, "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "stress_level", label: "压力水平", unit: "/10" },
                  { key: "sleep_duration", label: "睡眠时长", unit: "h" },
                  { key: "study_hours", label: "学习时长", unit: "h" },
                  { key: "social_media_hours", label: "社交媒体", unit: "h" },
                  { key: "physical_activity", label: "运动时长", unit: "min" },
                ].map(({ key, label, unit }) => (
                  <tr key={key}>
                    <td style={{ fontWeight: 500 }}>{label}</td>
                    <td>{(global_means as any)[key]}{unit}</td>
                    {clusters.map((c) => (
                      <td key={c.cluster_id}>
                        <span style={{
                          color: key === "stress_level"
                            ? ((c.features as any)[key] >= 6.5 ? "#ef4444" : (c.features as any)[key] >= 4 ? "#f59e0b" : "#22c55e")
                            : "var(--text-primary)",
                          fontWeight: 600,
                        }}>
                          {(c.features as any)[key]}{unit}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 风险分布柱状图 */}
        <div className="chart-card">
          <h3 style={{ marginBottom: 16 }}>各群体风险分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={riskBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="high" name="高风险" fill="#ef4444" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="medium" name="中风险" fill="#f59e0b" stackId="a" />
              <Bar dataKey="low" name="低风险" fill="#22c55e" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 群体解读与干预建议 */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 16 }}>💡 群体解读与干预建议</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {clusters.map((c) => (
            <div key={c.cluster_id} style={{
              padding: 20, borderRadius: 10,
              border: `1px solid ${CLUSTER_COLORS[c.cluster_id]}25`,
              background: `${CLUSTER_COLORS[c.cluster_id]}08`,
            }}>
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 12px 0" }}>
                {c.name}（{c.count}人，{c.percentage}%）
              </p>

              {/* 特征描述 */}
              {c.traits && c.traits.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 6px 0" }}>📊 特征画像</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {c.traits.map((t, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 12,
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 干预建议 */}
              {c.suggestions && c.suggestions.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 6px 0" }}>🎯 干预建议</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.suggestions.map((s, i) => (
                      <p key={i} style={{
                        fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7,
                        margin: 0, paddingLeft: 8,
                        borderLeft: `3px solid ${CLUSTER_COLORS[c.cluster_id]}40`,
                      }}>
                        {s}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
