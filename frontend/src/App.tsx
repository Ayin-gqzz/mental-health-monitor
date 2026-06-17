import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/guards/ProtectedRoute";
import { RoleGuard } from "./components/guards/RoleGuard";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import BehaviorHistory from "./pages/student/BehaviorHistory";
import AssessmentHistory from "./pages/student/AssessmentHistory";
import WeeklyAssessmentPage from "./pages/student/WeeklyAssessmentPage";
import WeeklyAssessmentHistory from "./pages/student/WeeklyAssessmentHistory";
import CounselorDashboard from "./pages/counselor/CounselorDashboard";
import StudentList from "./pages/counselor/StudentList";
import StudentDetail from "./pages/counselor/StudentDetail";
import StatisticsPage from "./pages/counselor/StatisticsPage";
import AlertsPage from "./pages/counselor/AlertsPage";
import StatAnalysisPage from "./pages/counselor/StatAnalysisPage";
import ClusterAnalysisPage from "./pages/counselor/ClusterAnalysisPage";
import ChangePasswordPage from "./pages/counselor/ChangePasswordPage";
import RegisterCounselorPage from "./pages/counselor/RegisterCounselorPage";
import WeeklyReviewPage from "./pages/counselor/WeeklyReviewPage";
import ReportPage from "./pages/counselor/ReportPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/student" element={<RoleGuard role="student"><StudentDashboard /></RoleGuard>} />
          <Route path="/student/behavior" element={<RoleGuard role="student"><BehaviorHistory /></RoleGuard>} />
          <Route path="/student/assessments" element={<RoleGuard role="student"><AssessmentHistory /></RoleGuard>} />
          <Route path="/student/weekly-assessment" element={<RoleGuard role="student"><WeeklyAssessmentPage /></RoleGuard>} />
          <Route path="/student/weekly-history" element={<RoleGuard role="student"><WeeklyAssessmentHistory /></RoleGuard>} />
          <Route path="/counselor" element={<RoleGuard role="counselor"><CounselorDashboard /></RoleGuard>} />
          <Route path="/counselor/students" element={<RoleGuard role="counselor"><StudentList /></RoleGuard>} />
          <Route path="/counselor/students/:id" element={<RoleGuard role="counselor"><StudentDetail /></RoleGuard>} />
          <Route path="/counselor/statistics" element={<RoleGuard role="counselor"><StatisticsPage /></RoleGuard>} />
          <Route path="/counselor/alerts" element={<RoleGuard role="counselor"><AlertsPage /></RoleGuard>} />
          <Route path="/counselor/stat-analysis" element={<RoleGuard role="counselor"><StatAnalysisPage /></RoleGuard>} />
          <Route path="/counselor/model-evaluation" element={<RoleGuard role="counselor"><ClusterAnalysisPage /></RoleGuard>} />
          <Route path="/counselor/change-password" element={<RoleGuard role="counselor"><ChangePasswordPage /></RoleGuard>} />
          <Route path="/counselor/register" element={<RoleGuard role="counselor"><RegisterCounselorPage /></RoleGuard>} />
          <Route path="/counselor/weekly-review" element={<RoleGuard role="counselor"><WeeklyReviewPage /></RoleGuard>} />
          <Route path="/counselor/report" element={<RoleGuard role="counselor"><ReportPage /></RoleGuard>} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
