import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "./firebase";

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:4000";
const TOKEN_KEY = "ai_tutor_jwt";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return window.localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const token = await credential.user.getIdToken();
  await setToken(token);
  return syncProfile(credential.user.displayName ?? email.split("@")[0]);
}

export async function signup(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  await updateProfile(credential.user, { displayName: name });
  const token = await credential.user.getIdToken();
  await setToken(token);
  return syncProfile(name);
}

async function syncProfile(name: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/profile", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export interface NextProblemResponse {
  source: "variation" | "seed_fallback";
  problem: {
    id: string;
    questionText: string;
  };
  note?: string;
}

export interface Concept {
  id: string;
  subject: string;
  chapter: string;
  topic: string;
  difficultyTier: number;
}

export function getConcepts(): Promise<Concept[]> {
  return request("/concepts");
}

export function getNextProblem(conceptId: string): Promise<NextProblemResponse> {
  return request(`/problems/next?conceptId=${conceptId}`);
}

export interface SubmitAttemptPayload {
  conceptId: string;
  seedProblemId?: string;
  variationId?: string;
  submittedAnswer: string;
  idempotencyKey: string;
  timeTakenSeconds?: number;
}

export interface SubmitAttemptResponse {
  attemptId: string;
  isCorrect: boolean;
  mastery: { masteryScore: number; consecutiveCorrect: number; consecutiveIncorrect: number };
  nextAction: { action: string; reason: string };
  diagnosisPending: boolean;
}

export function submitAttempt(payload: SubmitAttemptPayload): Promise<SubmitAttemptResponse> {
  return request("/attempts", { method: "POST", body: JSON.stringify(payload) });
}

export interface DiagnosisResponse {
  status: "pending" | "ready";
  intervention?: {
    diagnosedMisconception: string;
    explanationText: string;
    correctiveHint: string;
  };
}

export function getDiagnosis(attemptId: string): Promise<DiagnosisResponse> {
  return request(`/attempts/${attemptId}/diagnosis`);
}
