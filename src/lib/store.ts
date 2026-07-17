import { WorkLocation } from "./assistants";

export interface AttendanceRecord {
  assistantId: number;
  status: "var" | "yok" | "muaf";
  workLocation?: WorkLocation | string;
  timestamp?: string;
}

export interface Session {
  id: string;
  lessonName: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  active: boolean;
  attendance: AttendanceRecord[];
}

const STORAGE_KEY = "asistan-yoklama-sessions";

export function getSessions(): Session[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSession(session: Session): void {
  const sessions = getSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getActiveSession(): Session | null {
  const sessions = getSessions();
  return sessions.find((s) => s.active) || null;
}

export function deactivateAllSessions(): void {
  const sessions = getSessions().map((s) => ({ ...s, active: false }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function isWithinSessionTime(session: Session): boolean {
  const now = new Date();
  const [startH, startM] = session.startTime.split(":").map(Number);
  const [endH, endM] = session.endTime.split(":").map(Number);

  const todayStr = now.toISOString().split("T")[0];
  if (session.date !== todayStr) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const buffer = 15;
  return (
    currentMinutes >= startMinutes - buffer &&
    currentMinutes <= endMinutes + buffer
  );
}

export function exportToCSV(session: Session, assistantNames: Map<number, string>): string {
  const headers = ["Ad Soyad", "Durum", "Çalışma Yeri", "Saat"];
  const rows = session.attendance.map((a) => [
    assistantNames.get(a.assistantId) || "Bilinmiyor",
    a.status === "var" ? "VAR" : a.status === "muaf" ? "MUAF" : "YOK",
    a.workLocation || "-",
    a.timestamp || "-",
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  return csv;
}
