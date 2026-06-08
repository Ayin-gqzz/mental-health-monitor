import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "../../stores/authStore";

const PAGE_TITLES: Record<string, string> = {
  "/student": "学生首页",
  "/student/behavior": "行为记录",
  "/student/assessments": "评估记录",
  "/student/weekly-assessment": "心理测评",
  "/student/weekly-history": "测评记录",
  "/counselor": "辅导员工作台",
  "/counselor/students": "学生管理",
  "/counselor/statistics": "统计分析",
  "/counselor/stat-analysis": "统计检验",
  "/counselor/model-evaluation": "学生群体画像",
  "/counselor/alerts": "预警信息",
  "/counselor/change-password": "修改密码",
  "/counselor/register": "注册辅导员",
};

export function AppLayout() {
  const location = useLocation();
  const { role } = useAuthStore();

  let pageTitle = PAGE_TITLES[location.pathname] || "页面";
  if (location.pathname.startsWith("/counselor/students/")) {
    pageTitle = "学生详情";
  }

  const roleLabel = role === "counselor" ? "辅导员" : "学生";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Header */}
        <header style={{
          height: 56,
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          flexShrink: 0,
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{pageTitle}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontSize: 12,
              padding: "3px 10px",
              borderRadius: 20,
              background: role === "counselor" ? "var(--primary-light)" : "var(--success-light)",
              color: role === "counselor" ? "var(--primary)" : "var(--success)",
              fontWeight: 600,
            }}>
              {roleLabel}
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main style={{
          flex: 1,
          overflow: "auto",
          padding: 28,
          background: "var(--bg-page)",
        }}>
          <div className="animate-fadeIn" style={{ maxWidth: 1400, margin: "0 auto" }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
