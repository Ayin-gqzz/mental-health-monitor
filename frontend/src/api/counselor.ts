import client from "./client";
import type { PaginatedResponse } from "./student";

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
  const res = await client.get("/counselor/statistics/overview");
  return res.data as OverviewStats;
}

export async function getDepartmentStats() {
  const res = await client.get("/counselor/statistics/departments");
  return res.data as DepartmentStats[];
}

export async function getTrends(department = "") {
  const res = await client.get("/counselor/statistics/trends", { params: { department } });
  return res.data;
}

export async function getAlerts(page = 1, pageSize = 20, department = "", isRead = "") {
  const params: Record<string, any> = { page, page_size: pageSize };
  if (department) params.department = department;
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
  const res = await client.get("/counselor/statistics/t-test");
  return res.data as TTestResult[];
}

export async function getStatChiSquare() {
  const res = await client.get("/counselor/statistics/chi-square");
  return res.data as ChiSquareResult;
}

export async function getStatCorrelation() {
  const res = await client.get("/counselor/statistics/correlation");
  return res.data as CorrelationResult[];
}

export async function getStressDistribution() {
  const res = await client.get("/counselor/statistics/stress-distribution");
  return res.data as { stress_level: number; count: number }[];
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
  }[];
  scatter: { student_id: string; x: number; y: number; cluster: number }[];
  global_means: Record<string, number>;
  feature_names: string[];
  total_students: number;
}

export async function getClusterAnalysis() {
  const res = await client.get("/counselor/cluster-analysis");
  return res.data as ClusterData;
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
