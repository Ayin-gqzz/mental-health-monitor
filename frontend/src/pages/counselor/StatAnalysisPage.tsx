import { useEffect, useState } from "react";
import {
  getStatTTest, getStatChiSquare, getStatCorrelation,
  type TTestResult, type ChiSquareResult, type CorrelationResult,
} from "../../api/counselor";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
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

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <div className="spinner-lg spinner" />
    </div>
  );

  const pearsonData = correlations.filter(c => c.method === "pearson").map(c => ({
    name: c.variable_label, value: c.correlation, significant: c.significant,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>🔬 统计检验</h1>
        <p className="subtitle">T检验、卡方检验和相关性分析结果</p>
      </div>

      {/* T-Test Section */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-light)" }}>
          <h3 style={{ margin: 0 }}>T 检验 — 高风险 vs 低风险群体</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
            Welch's t-test（不等方差），显著性水平 α = 0.05
          </p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {["指标", "高风险均值", "低风险均值", "t 统计量", "p 值", "是否显著"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tTests.map(t => (
                <tr key={t.metric}>
                  <td style={{ fontWeight: 500 }}>{t.metric_label}</td>
                  <td>{t.group1_mean} (n={t.group1_n})</td>
                  <td>{t.group2_mean} (n={t.group2_n})</td>
                  <td>{t.t_statistic}</td>
                  <td>{t.p_value < 0.001 ? "< 0.001" : t.p_value}</td>
                  <td>
                    <span className={`badge ${t.significant ? "badge-danger" : "badge-success"}`}>
                      {t.significant ? "显著" : "不显著"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chi-Square Section */}
      {chiSquare && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20 }}>卡方检验 — 性别与抑郁的关联</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <h4 style={{ marginBottom: 12, color: "var(--text-secondary)" }}>列联表</h4>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>无抑郁</th>
                      <th>有抑郁</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["男性", "女性"].map((label, i) => (
                      <tr key={label}>
                        <td style={{ fontWeight: 500 }}>{label}</td>
                        <td>{chiSquare.contingency_table[i][0]}</td>
                        <td>{chiSquare.contingency_table[i][1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ textAlign: "center", padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>卡方统计量</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>{chiSquare.chi2_statistic}</p>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>自由度</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>{chiSquare.degrees_of_freedom}</p>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "var(--bg-page)", borderRadius: "var(--radius-md)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>p 值</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: chiSquare.significant ? "var(--danger)" : "var(--success)" }}>
                    {chiSquare.p_value < 0.001 ? "< 0.001" : chiSquare.p_value}
                  </p>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: chiSquare.significant ? "var(--danger-light)" : "var(--success-light)", borderRadius: "var(--radius-md)" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>结论</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: chiSquare.significant ? "var(--danger)" : "var(--success)" }}>
                    {chiSquare.significant ? "存在显著关联" : "无显著关联"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correlation Section */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 8 }}>相关性分析 — 生活方式与抑郁</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 20 }}>
          Pearson 和 Spearman 相关系数，显著性水平 α = 0.05
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div>
            <h4 style={{ marginBottom: 12, color: "var(--text-secondary)" }}>Pearson 相关系数</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pearsonData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" domain={[-0.3, 0.3]} fontSize={11} stroke="var(--text-muted)" />
                <YAxis type="category" dataKey="name" fontSize={11} stroke="var(--text-muted)" />
                <Tooltip formatter={(v: any) => Number(v).toFixed(4)} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }} />
                <Bar dataKey="value" name="相关系数" radius={[0, 6, 6, 0]}>
                  {pearsonData.map((entry, i) => (
                    <Cell key={i} fill={entry.value >= 0 ? "#4f6ef7" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 style={{ marginBottom: 12, color: "var(--text-secondary)" }}>详细结果</h4>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {["变量", "方法", "相关系数", "p 值", "显著"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlations.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 13 }}>{c.variable_label}</td>
                      <td style={{ fontSize: 13 }}>{c.method === "pearson" ? "Pearson" : "Spearman"}</td>
                      <td style={{ fontSize: 13, color: c.correlation >= 0 ? "var(--primary)" : "var(--danger)", fontWeight: 500 }}>
                        {c.correlation.toFixed(4)}
                      </td>
                      <td style={{ fontSize: 13 }}>{c.p_value < 0.001 ? "< 0.001" : c.p_value}</td>
                      <td>
                        <span className={`badge ${c.significant ? "badge-danger" : "badge-success"}`} style={{ fontSize: 11 }}>
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
    </div>
  );
}
