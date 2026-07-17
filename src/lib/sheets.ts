import { Session } from "./store";
import { assistants } from "./assistants";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_ysXd0y-IsFSEq-_MtPLzPjZi6Mv7GecY_PXjMdHnZMzqOQLLWSjcUNq2iS_njMg5/exec";

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
      return data.sessions.find((s: Session) => s.id === sessionId) || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadSessionsFromCloud(): Promise<Session[]> {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getSessions`, {
      method: "GET",
    });
    const data = await response.json();
    if (data && Array.isArray(data.sessions)) {
      return data.sessions;
    }
    return [];
  } catch {
    console.error("Cloud session load failed");
    return [];
  }
}
