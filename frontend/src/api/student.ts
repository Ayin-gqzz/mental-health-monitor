import client from "./client";

export interface StudentProfile {
  student_id: string;
  name: string;
  age: number;
  gender: string;
  department: string;
  cgpa: number;
}

export interface BehaviorLatest {
  sleep_duration: number;
  study_hours: number;
  social_media_hours: number;
  physical_activity: number;
  stress_level: number;
  record_date: string;
}

export interface AssessmentLatest {
  assessment_date: string;
  depression_predicted: boolean;
  depression_probability: number;
  risk_level: string;
  intervention_text: string | null;
  counselor_notes: string | null;
}

export interface DashboardData {
  profile: StudentProfile;
  latest_behavior: BehaviorLatest | null;
  latest_assessment: AssessmentLatest | null;
  trend: { week: string; avg_stress: number; avg_sleep: number }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await client.get("/student/dashboard");
  return res.data;
}

export async function getBehaviorHistory(page = 1, pageSize = 10) {
  const res = await client.get("/student/behavior", { params: { page, page_size: pageSize } });
  return res.data as PaginatedResponse<any>;
}

export async function getBehaviorLatest() {
  const res = await client.get("/student/behavior/latest");
  return res.data as BehaviorLatest;
}

export async function getBehaviorTrend() {
  const res = await client.get("/student/behavior/trend");
  return res.data;
}

export async function getAssessments(page = 1, pageSize = 10) {
  const res = await client.get("/student/assessments", { params: { page, page_size: pageSize } });
  return res.data as PaginatedResponse<any>;
}

export async function getAssessmentLatest() {
  const res = await client.get("/student/assessments/latest");
  return res.data as AssessmentLatest | null;
}
