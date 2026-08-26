import { NextRequest } from "next/server";
import { markAttendance, markAttendanceBulk, getAttendance, AttendanceRecord, Status } from "@/lib/db";

const STATUSES: Status[] = ["var", "yok", "muaf"];

function parseRecord(raw: unknown): AttendanceRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const assistantId = Number(r.assistantId);
  const status = r.status as Status;
  if (!Number.isInteger(assistantId) || !STATUSES.includes(status)) return null;
  return {
    assistantId,
    status,
    workLocation: typeof r.workLocation === "string" ? r.workLocation : "",
    timestamp: typeof r.timestamp === "string" ? r.timestamp : new Date().toISOString(),
  };
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/attendance">) {
  const { id } = await ctx.params;
  return Response.json({ attendance: await getAttendance(id) });
}

/**
 * Tek kayıt:  { assistantId, status, workLocation? }
 * Toplu:      { records: [ ... ] }
 * İkisi de tek veritabanı turunda biter.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/attendance">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Geçersiz istek." }, { status: 400 });

  if (Array.isArray(body.records)) {
    const records = body.records.map(parseRecord);
    if (records.some((r: AttendanceRecord | null) => r === null)) {
      return Response.json({ error: "Kayıtlardan biri geçersiz." }, { status: 400 });
    }
    const count = await markAttendanceBulk(id, records as AttendanceRecord[]);
    return Response.json({ ok: true, count });
  }

  const record = parseRecord(body);
  if (!record) return Response.json({ error: "Geçersiz kayıt." }, { status: 400 });

  await markAttendance(id, record);
  return Response.json({ ok: true });
}
