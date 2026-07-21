import { Session } from "./store";
import { assistants } from "./assistants";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_ysXd0y-IsFSEq-_MtPLzPjZi6Mv7GecY_PXjMdHnZMzqOQLLWSjcUNq2iS_njMg5/exec";

function normalizeDate(val: string): string {
  if (!val || typeof val !== "string") return val;
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    if (year < 1900) {
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
    return `${day}.${month}.${year}`;
  }
  return val;
}

function normalizeSession(s: Session): Session {
  return {
    ...s,
    date: normalizeDate(s.date),
    startTime: normalizeDate(s.startTime),
    endTime: normalizeDate(s.endTime),
  };
}

export async function syncToGoogleSheets(session: Session): Promise<boolean> {
  try {
    const payload = {
      type: "attendance",
      lessonName: session.lessonName,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      attendance: session.attendance.map((a) => ({
        name: assistants.find((ast) => ast.id === a.assistantId)?.name || "",
        endDate: assistants.find((ast) => ast.id === a.assistantId)?.endDate || "",
        status: a.status === "var" ? "VAR" : a.status === "muaf" ? "MUAF" : "YOK",
        workLocation: a.workLocation || "",
        timestamp: a.timestamp || "",
      })),
    };

    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });

    return true;
  } catch {
    console.error("Google Sheets sync failed");
    return false;
  }
}

export async function saveSessionToCloud(session: Session): Promise<boolean> {
  try {
    const payload = {
      type: "session",
      session: {
        id: session.id,
        lessonName: session.lessonName,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        createdAt: session.createdAt,
        active: session.active,
        attendance: session.attendance.map((a) => ({
          assistantId: a.assistantId,
          status: a.status,
          workLocation: a.workLocation || "",
          timestamp: a.timestamp || "",
        })),
      },
    };

    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });

    return true;
  } catch {
    console.error("Cloud session save failed");
    return false;
  }
}

export async function updateAttendanceInCloud(
  sessionId: string,
  assistantId: number,
  status: string,
  workLocation?: string,
  timestamp?: string
): Promise<boolean> {
  try {
    const payload = {
      type: "attendance_update",
      sessionId,
      assistantId,
      status,
      workLocation: workLocation || "",
      timestamp: timestamp || "",
    };
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    console.error("Cloud attendance update failed");
    return false;
  }
}

export async function loadSessionFromCloud(sessionId: string): Promise<Session | null> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getSessions`, {
      method: "GET",
    });
    const data = await response.json();
    if (data && Array.isArray(data.sessions)) {
      const found = data.sessions.find((s: Session) => s.id === sessionId);
      return found ? normalizeSession(found) : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function claimTokenFromCloud(
  sessionId: string,
  token: string,
  assistantId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${APPS_SCRIPT_URL}?action=claimToken&sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}&assistantId=${assistantId}`,
      { method: "GET" }
    );
    return await response.json();
  } catch {
    return { success: false, error: "network_error" };
  }
}

export async function loadDailySchedule(): Promise<string[]> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getDailySchedule`, {
      method: "GET",
    });
    const data = await response.json();
    if (data && data.success && Array.isArray(data.assignments)) {
      return data.assignments;
    }
    return [];
  } catch {
    console.error("Daily schedule load failed");
    return [];
  }
}

export async function loadSessionsFromCloud(): Promise<Session[]> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getSessions`, {
      method: "GET",
    });
    const data = await response.json();
    if (data && Array.isArray(data.sessions)) {
      return data.sessions.map((s: Session) => normalizeSession(s));
    }
    return [];
  } catch {
    console.error("Cloud session load failed");
    return [];
  }
}
