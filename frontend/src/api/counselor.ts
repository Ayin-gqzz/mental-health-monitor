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

export async function getAlerts(page = 1, pageSize = 20, department = "") {
  const res = await client.get("/counselor/alerts", { params: { page, page_size: pageSize, department } });
  return res.data as PaginatedResponse<any>;
}

export async function getComplexQuery() {
  const res = await client.get("/counselor/statistics/complex-query");
  return res.data as ComplexQueryResult;
}
