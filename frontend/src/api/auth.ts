import client from "./client";

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  student_id: string;
  name: string;
  password: string;
  age: number;
  gender: string;
  department: string;
  cgpa: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  display_name: string;
  user_id: string;
}

export async function login(data: LoginData): Promise<TokenResponse> {
  const res = await client.post("/auth/login", data);
  return res.data;
}

export async function loginCounselor(data: LoginData): Promise<TokenResponse> {
  const res = await client.post("/auth/login/counselor", data);
  return res.data;
}

export async function register(data: RegisterData): Promise<TokenResponse> {
  const res = await client.post("/auth/register", data);
  return res.data;
}
