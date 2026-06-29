import client from "./client";
import type { PaginatedResponse } from "./student";

// 前端缓存：避免重复请求
const _cache = new Map<string, { data: any; time: number }>();
function cached(key: string, fetcher: () => Promise<any>, ttl = 300000): Promise<any> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.time < ttl) return Promise.resolve(hit.data);
  return fetcher().then((data) => { _cache.set(key, { data, time: Date.now() }); return data; });
}

export interface StudentListItem {
  student_id: string;
  name: string;
  age: number;
  gender: string;
  department: string;
  cgpa: number;
  risk_level: string | null;
}

export interface StudentDetail {
  profile: any;
  latest_behavior: any;
  latest_assessment: any;
}

export interface OverviewStats {
  total_students: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  avg_stress: number;
  depression_rate: number;
}

export interface DepartmentStats {
  department: string;
  student_count: number;
  avg_stress: number;
  avg_cgpa: number;
  depression_rate: number;
  high_risk_count: number;
}

export interface ComplexQueryResult {
  slow_query_ms: number;
  optimized_query_ms: number;
  improvement_pct: number;
  data: any[];
}

export interface TTestResult {
  metric: string;
  metric_label: string;
  group1_mean: number;
  group2_mean: number;
  t_statistic: number;
  p_value: number;
  significant: boolean;
  group1_n: number;
  group2_n: number;
}

export interface ChiSquareResult {
  chi2_statistic: number;
  p_value: number;
  degrees_of_freedom: number;
  significant: boolean;
  contingency_table: number[][];
}

export interface CorrelationResult {
  variable: string;
  variable_label: string;
  method: string;
  correlation: number;
  p_value: number;
  significant: boolean;
}

export interface NotificationItem {
  id: number;
  student_id: string;
  name: string;
  department: string;
  gender: string;
  risk_level: string;
  message: string;
  is_read: boolean;
  depression_probability: number;
  assessment_date: string | null;
  created_at: string | null;
}

export async function getStudents(params: Record<string, any> = {}) {
  // 只缓存第一页无筛选的请求
  const key = JSON.stringify(params);
  if (params.page === 1 && !params.search && !params.department && !params.risk_level) {
    return cached(`students_${key}`, async () => {
      const res = await client.get("/counselor/students", { params });
      return res.data as PaginatedResponse<StudentListItem>;
    });
  }
  const res = await client.get("/counselor/students", { params });
  return res.data as PaginatedResponse<StudentListItem>;
}

export async function getStudentDetail(studentId: string) {
  const res = await client.get(`/counselor/students/${studentId}`);
  return res.data as StudentDetail;
}

export async function getStudentBehavior(studentId: string, page = 1, pageSize = 10) {
  const res = await client.get(`/counselor/students/${studentId}/behavior`, { params: { page, page_size: pageSize } });
  return res.data as PaginatedResponse<any>;
}

export async function getStudentAssessments(studentId: string, page = 1, pageSize = 10) {
  const res = await client.get(`/counselor/students/${studentId}/assessments`, { params: { page, page_size: pageSize } });
  return res.data as PaginatedResponse<any>;
}

export async function triggerAssessment(studentId: string) {
  const res = await client.post(`/counselor/students/${studentId}/assess`);
  return res.data;
}

export async function triggerAssessAll() {
  const res = await client.post("/counselor/assess-all");
  return res.data;
}

export async function updateNotes(studentId: string, counselorNotes: string) {
  const res = await client.put(`/counselor/students/${studentId}/notes`, { counselor_notes: counselorNotes });
  return res.data;
}

export async function getOverviewStats() {
  return cached("overview", async () => {
    const res = await client.get("/counselor/statistics/overview");
    return res.data as OverviewStats;
  });
}

export async function getDepartmentStats() {
  return cached("departments", async () => {
    const res = await client.get("/counselor/statistics/departments");
    return res.data as DepartmentStats[];
  });
}

export async function getTrends(department = "") {
  return cached(`trends_${department}`, async () => {
    const res = await client.get("/counselor/statistics/trends", { params: { department } });
    return res.data;
  });
}

export async function getAlerts(page = 1, pageSize = 20, department = "", gender = "", isRead = "") {
  // 列表数据不缓存，但预警数量缓存
  if (page === 1 && !department && !gender && !isRead) {
    return cached("alerts_p1", async () => {
      const res = await client.get("/counselor/alerts", { params: { page, page_size: pageSize } });
      return res.data as PaginatedResponse<NotificationItem>;
    }, 30000);
  }
  const params: Record<string, any> = { page, page_size: pageSize };
  if (department) params.department = department;
  if (gender) params.gender = gender;
  if (isRead) params.is_read = isRead;
  const res = await client.get("/counselor/alerts", { params });
  return res.data as PaginatedResponse<NotificationItem>;
}

export async function getUnreadCount() {
  const res = await client.get("/counselor/notifications/unread-count");
  return res.data as { unread_count: number };
}

export async function markAsRead(notificationId: number) {
  const res = await client.put(`/counselor/notifications/${notificationId}/read`);
  return res.data;
}

export async function markAllAsRead() {
  const res = await client.put("/counselor/notifications/read-all");
  return res.data;
}

export async function getComplexQuery() {
  const res = await client.get("/counselor/statistics/complex-query");
  return res.data as ComplexQueryResult;
}

export async function getStatTTest() {
  return cached("stat_ttest", async () => {
    const res = await client.get("/counselor/statistics/t-test");
    return res.data as TTestResult[];
  });
}

export async function getStatChiSquare() {
  return cached("stat_chisquare", async () => {
    const res = await client.get("/counselor/statistics/chi-square");
    return res.data as ChiSquareResult;
  });
}

export async function getStatCorrelation() {
  return cached("stat_correlation", async () => {
    const res = await client.get("/counselor/statistics/correlation");
    return res.data as CorrelationResult[];
  });
}

export async function getStressDistribution() {
  return cached("stress_dist", async () => {
    const res = await client.get("/counselor/statistics/stress-distribution");
    return res.data as { stress_level: number; count: number }[];
  });
}

export async function getModelEvaluation() {
  const res = await client.get("/counselor/model/evaluation");
  return res.data;
}

export interface ClusterData {
  clusters: {
    cluster_id: number;
    name: string;
    count: number;
    percentage: number;
    features: {
      stress_level: number;
      sleep_duration: number;
      study_hours: number;
      social_media_hours: number;
      physical_activity: number;
    };
    risk_distribution: { high: number; medium: number; low: number; none: number };
    gender_ratio: { male: number; female: number };
    traits?: string[];
    suggestions?: string[];
  }[];
  scatter: { student_id: string; x: number; y: number; cluster: number }[];
  global_means: Record<string, number>;
  feature_names: string[];
  total_students: number;
}

export async function getClusterAnalysis() {
  return cached("cluster_analysis", async () => {
    const res = await client.get("/counselor/cluster-analysis", { timeout: 60000 });
    return res.data as ClusterData;
  }, 600000); // 10 分钟缓存，与后端对齐
}

export async function registerCounselor(username: string, password: string, displayName: string) {
  const res = await client.post("/auth/register/counselor", {
    username, password, display_name: displayName,
  });
  return res.data;
}

export async function changeCounselorPassword(oldPassword: string, newPassword: string) {
  const res = await client.put("/auth/counselor/password", {
    old_password: oldPassword, new_password: newPassword,
  });
  return res.data;
}

// ── Counselor Reports ──────────────────────────────────────

export interface CounselorReportItem {
  id: number;
  counselor_id: number;
  department: string;
  report_week: string;
  overall_status: string;
  abnormal_cases: string;
  key_students: string;
  created_at: string | null;
  counselor_name?: string;
}

export async function getReports(page = 1, pageSize = 20, reportWeek = "") {
  const params: Record<string, any> = { page, page_size: pageSize };
  if (reportWeek) params.report_week = reportWeek;
  const res = await client.get("/counselor/reports", { params });
  return res.data as PaginatedResponse<CounselorReportItem>;
}

export async function submitReport(data: { overall_status: string; abnormal_cases?: string; key_students?: string; report_week?: string }) {
  const res = await client.post("/counselor/reports", data);
  return res.data;
}

export async function getLatestReports() {
  const res = await client.get("/counselor/reports/latest");
  return res.data as CounselorReportItem[];
}

// ── Weekly Assessment Management ──────────────────────────────

export interface WeeklyAssessmentItem {
  id: number;
  student_id: string;
  student_name: string;
  department: string;
  gender: string;
  submit_date: string;
  mood_score: number;
  sleep_quality: number;
  study_state: number;
  social_state: number;
  life_satisfaction: number;
  overall_score: number;
  sentiment_score: number | null;
  message: string | null;
  ai_reply: string | null;
  counselor_reply: string | null;
}

export interface WeeklyAssessmentDetail extends WeeklyAssessmentItem {
  nlp_analysis?: {
    sentiment_score: number;
    sentiment_label: string;
    keywords: [string, number][];
    psychological_topics: Record<string, number>;
    word_frequency: Record<string, number>;
    token_count: number;
    char_count: number;
  };
}

export interface WeeklyAssessmentStats {
  total: number;
  with_message: number;
  replied: number;
  unreplied: number;
  recent_7days: number;
}

export async function getWeeklyAssessments(params: Record<string, any> = {}) {
  const res = await client.get("/counselor/weekly-assessments", { params });
  return res.data as PaginatedResponse<WeeklyAssessmentItem>;
}

export async function getWeeklyAssessmentDetail(id: number) {
  const res = await client.get(`/counselor/weekly-assessments/${id}`);
  return res.data as WeeklyAssessmentDetail;
}

export async function replyWeeklyAssessment(id: number, reply: string) {
  const res = await client.post(`/counselor/weekly-assessments/${id}/reply`, { reply });
  return res.data;
}

export async function analyzeWeeklyMessage(id: number) {
  const res = await client.post(`/counselor/weekly-assessments/${id}/analyze`);
  return res.data;
}

export async function getWeeklyAssessmentStats() {
  const res = await client.get("/counselor/weekly-assessments/stats");
  return res.data as WeeklyAssessmentStats;
}
