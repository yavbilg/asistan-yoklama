/** Tarayıcı tarafından API uçlarına erişim. Tüm veri buradan geçer. */

export type Status = "var" | "yok" | "muaf";

export interface Assistant {
  id: number;
  name: string;
  endDate: string;
  active: boolean;
}

export interface AttendanceRecord {
  assistantId: number;
  status: Status;
  workLocation?: string;
  timestamp?: string;
}

export interface Session {
  id: string;
  lessonName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  createdAt: string;
  active: boolean;
  attendance: AttendanceRecord[];
}

export interface SessionSummary extends Omit<Session, "attendance"> {
  counts: { var: number; yok: number; muaf: number };
}

async function istek<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    // Sunucu hatayı JSON olarak açıklıyorsa onu göster, yoksa durum kodunu.
    const govde = await res.json().catch(() => null);
    throw new Error(govde?.error ?? `Sunucu hatası (${res.status})`);
  }
  return res.json();
}

/* ---------- Asistanlar ---------- */

export async function fetchAssistants(includeInactive = false): Promise<Assistant[]> {
  const { assistants } = await istek<{ assistants: Assistant[] }>(
    `/api/assistants${includeInactive ? "?all=1" : ""}`
  );
  return assistants;
}

export async function addAssistant(name: string, endDate: string): Promise<Assistant> {
  const { assistant } = await istek<{ assistant: Assistant }>("/api/assistants", {
    method: "POST",
    body: JSON.stringify({ name, endDate }),
  });
  return assistant;
}

export async function patchAssistant(
  id: number,
  fields: { name?: string; endDate?: string; active?: boolean }
): Promise<void> {
  await istek(`/api/assistants/${id}`, { method: "PATCH", body: JSON.stringify(fields) });
}

export async function removeAssistant(id: number): Promise<void> {
  await istek(`/api/assistants/${id}`, { method: "DELETE" });
}

/* ---------- Oturumlar ---------- */

export async function fetchSessions(): Promise<SessionSummary[]> {
  const { sessions } = await istek<{ sessions: SessionSummary[] }>("/api/sessions");
  return sessions;
}

export async function fetchActiveSession(): Promise<Session | null> {
  const { session } = await istek<{ session: Session | null }>("/api/sessions?active=1");
  return session;
}

export async function fetchSession(id: string): Promise<Session> {
  const { session } = await istek<{ session: Session }>(`/api/sessions/${id}`);
  return session;
}

export interface ScheduleInfo {
  sheetName?: string;
  matched: number;
  warnings: string[];
}

export async function startSession(input: {
  lessonName: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<{ session: Session; schedule?: ScheduleInfo }> {
  return istek<{ session: Session; schedule?: ScheduleInfo }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function finishSession(id: string): Promise<void> {
  await istek(`/api/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active: false }),
  });
}

/* ---------- Yoklama ---------- */

export async function markOne(sessionId: string, rec: AttendanceRecord): Promise<void> {
  await istek(`/api/sessions/${sessionId}/attendance`, {
    method: "POST",
    body: JSON.stringify(rec),
  });
}

export async function markMany(
  sessionId: string,
  records: AttendanceRecord[]
): Promise<void> {
  await istek(`/api/sessions/${sessionId}/attendance`, {
    method: "POST",
    body: JSON.stringify({ records }),
  });
}

/* ---------- QR ---------- */

export async function fetchToken(
  sessionId: string
): Promise<{ token: string; secondsRemaining: number }> {
  return istek(`/api/sessions/${sessionId}/token`);
}

export async function claimAttendance(
  sessionId: string,
  token: string,
  assistantId: number,
  status: "var" | "muaf" = "var",
  workLocation?: string
): Promise<void> {
  await istek(`/api/sessions/${sessionId}/claim`, {
    method: "POST",
    body: JSON.stringify({ token, assistantId, status, workLocation }),
  });
}

/* ---------- Yardımcılar ---------- */

/** 2026-08-23 → 23.08.2026 */
export function trTarih(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, a, g] = iso.split("-");
  return `${g}.${a}.${y}`;
}

/**
 * Bugünün tarihi, YYYY-AA-GG — Türkiye saatine göre.
 * Cihazın saat dilimi farklıysa oturum yanlış güne açılmasın diye sabitlendi.
 */
const TARIH_BICIMI = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function bugun(): string {
  return TARIH_BICIMI.format(new Date()); // en-CA => YYYY-MM-DD
}

/**
 * ISO zaman damgasından SS:DD.
 * Saat dilimi açıkça veriliyor: cihazın diliminden bağımsız olarak Excel
 * çıktısıyla aynı değeri göstersin.
 */
const SAAT_BICIMI = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function saat(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return SAAT_BICIMI.format(d);
}
