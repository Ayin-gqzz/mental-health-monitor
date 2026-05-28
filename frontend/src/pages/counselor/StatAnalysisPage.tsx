import { useEffect, useState } from "react";
import {
  getStatTTest, getStatChiSquare, getStatCorrelation,
  type TTestResult, type ChiSquareResult, type CorrelationResult,
} from "../../api/counselor";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

export default function StatAnalysisPage() {
  const [tTests, setTTests] = useState<TTestResult[]>([]);
  const [chiSquare, setChiSquare] = useState<ChiSquareResult | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStatTTest(), getStatChiSquare(), getStatCorrelation()]).then(
      ([tt, cs, cr]) => { setTTests(tt); setChiSquare(cs); setCorrelations(cr); setLoading(false); }
    );
  }, []);

  if (loading) return <p>Loading...</p>;

  const pearsonData = correlations.filter(c => c.method === "pearson").map(c => ({
    name: c.variable_label, value: c.correlation, significant: c.significant,
  }));

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>统计检验</h1>

      {/* T-Test Section */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>T 检验 — 高风险 vs 低风险群体生活习惯差异</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
          Welch's t-test (不等方差)，显著性水平 &alpha; = 0.05
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              {["指标", "高风险均值", "低风险均值", "t 统计量", "p 值", "是否显著"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tTests.map(t => (
              <tr key={t.metric} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "10px 16px", fontWeight: 500 }}>{t.metric_label}</td>
                <td style={{ padding: "10px 16px" }}>{t.group1_mean} (n={t.group1_n})</td>
                <td style={{ padding: "10px 16px" }}>{t.group2_mean} (n={t.group2_n})</td>
                <td style={{ padding: "10px 16px" }}>{t.t_statistic}</td>
                <td style={{ padding: "10px 16px" }}>{t.p_value < 0.001 ? "< 0.001" : t.p_value}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{
                    padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: t.significant ? "#fef2f2" : "#f0fdf4",
                    color: t.significant ? "#e94560" : "#22c55e",
                  }}>
                    {t.significant ? "显著" : "不显著"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chi-Square Section */}
      {chiSquare && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>卡方检验 — 性别与抑郁的关联</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <h4 style={{ marginBottom: 12, fontSize: 14, color: "#666" }}>列联表</h4>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th style={{ padding: "8px 16px", fontSize: 13, color: "#666" }}></th>
                    <th style={{ padding: "8px 16px", fontSize: 13, color: "#666" }}>无抑郁</th>
                    <th style={{ padding: "8px 16px", fontSize: 13, color: "#666" }}>有抑郁</th>
                  </tr>
                </thead>
                <tbody>
                  {["男性", "女性"].map((label, i) => (
                    <tr key={label} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "8px 16px", fontWeight: 500 }}>{label}</td>
                      <td style={{ padding: "8px 16px" }}>{chiSquare.contingency_table[i][0]}</td>
                      <td style={{ padding: "8px 16px" }}>{chiSquare.contingency_table[i][1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ textAlign: "center", padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: "#888" }}>卡方统计量</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{chiSquare.chi2_statistic}</p>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: "#888" }}>自由度</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{chiSquare.degrees_of_freedom}</p>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: "#888" }}>p 值</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: chiSquare.significant ? "#e94560" : "#22c55e" }}>
                    {chiSquare.p_value < 0.001 ? "< 0.001" : chiSquare.p_value}
                  </p>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: chiSquare.significant ? "#fef2f2" : "#f0fdf4", borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: "#888" }}>结论</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: chiSquare.significant ? "#e94560" : "#22c55e" }}>
                    {chiSquare.significant ? "存在显著关联" : "无显著关联"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correlation Section */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <h3 style={{ marginBottom: 16 }}>相关性分析 — 生活方式与抑郁</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
          Pearson 和 Spearman 相关系数，显著性水平 &alpha; = 0.05
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <h4 style={{ marginBottom: 12, fontSize: 14, color: "#666" }}>Pearson 相关系数</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pearsonData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[-0.3, 0.3]} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} />
                <Tooltip formatter={(v: number) => v.toFixed(4)} />
                <Bar dataKey="value" name="相关系数" radius={[0, 4, 4, 0]}>
                  {pearsonData.map((entry, i) => (
                    <Cell key={i} fill={entry.value >= 0 ? "#3b82f6" : "#e94560"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 style={{ marginBottom: 12, fontSize: 14, color: "#666" }}>详细结果</h4>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
                  {["变量", "方法", "相关系数", "p 值", "显著"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", fontSize: 12, color: "#666" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlations.map((c, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", fontSize: 13 }}>{c.variable_label}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13 }}>{c.method === "pearson" ? "Pearson" : "Spearman"}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: c.correlation >= 0 ? "#3b82f6" : "#e94560" }}>
                      {c.correlation.toFixed(4)}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 13 }}>{c.p_value < 0.001 ? "< 0.001" : c.p_value}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{
                        padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: c.significant ? "#fef2f2" : "#f0fdf4",
                        color: c.significant ? "#e94560" : "#22c55e",
                      }}>
                        {c.significant ? "是" : "否"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
