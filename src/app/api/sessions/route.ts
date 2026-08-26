import { NextRequest } from "next/server";
import {
  listSessions,
  createSession,
  getActiveSession,
  deactivateAllSessions,
  listAssistants,
  markAttendanceBulk,
  getSession,
  getDutyAssignments,
  getRotationsForDate,
} from "@/lib/db";
import { initialAttendance } from "@/lib/exemptions";
import { isExempt, type WorkLocation } from "@/lib/assistants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function GET(req: NextRequest) {
  // ?active=1 → sadece açık oturum (yoklama ekranının ilk yüklemesi için)
  if (req.nextUrl.searchParams.get("active") === "1") {
    const session = await getActiveSession();
    return Response.json({ session });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 100;
  const sessions = await listSessions(Math.min(limit, 500));
  return Response.json({ sessions });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const lessonName = typeof body?.lessonName === "string" ? body.lessonName.trim() : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";

  if (!lessonName) return Response.json({ error: "Ders adı gerekli." }, { status: 400 });
  if (!DATE_RE.test(date)) {
    return Response.json({ error: "Tarih YYYY-AA-GG olmalı." }, { status: 400 });
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return Response.json({ error: "Saat SS:DD olmalı." }, { status: 400 });
  }
  if (endTime <= startTime) {
    return Response.json({ error: "Bitiş saati başlangıçtan sonra olmalı." }, { status: 400 });
  }

  // Tek seferde tek aktif oturum olsun.
  await deactivateAllSessions();

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const session = await createSession({ id, lessonName, date, startTime, endTime });

  // Yeni oturumsa herkesi başlangıç durumuna yaz. Aynı slot yeniden açıldıysa
  // mevcut yoklamaya dokunulmaz — girilmiş işaretlemeler silinmesin.
  if (session.attendance.length === 0) {
    const [assistants, gorevler, rotasyonlar] = await Promise.all([
      listAssistants(),
      // İkisi de önceden yüklenip veritabanına yazıldığı için dış çağrı yok.
      getDutyAssignments(date),
      getRotationsForDate(date),
    ]);

    // Önce aylık rotasyon (kişi o ay nerede), üstüne günlük görev (o gün ne
    // yapıyor) — günlük bilgi daha özel olduğu için sonra uygulanır.
    const muaf: Record<number, WorkLocation> = {};
    for (const [id, yer] of Object.entries({ ...rotasyonlar, ...gorevler })) {
      if (isExempt(yer)) muaf[Number(id)] = yer as WorkLocation;
    }

    await markAttendanceBulk(session.id, initialAttendance(assistants, muaf));
    const dolu = await getSession(session.id);

    return Response.json(
      {
        session: dolu ?? session,
        schedule: {
          matched: Object.keys(muaf).length,
          warnings:
            Object.keys(gorevler).length === 0
              ? [
                  `${date} için görev çizelgesi yüklenmemiş. Yalnızca kıdem ve ` +
                    `sabit muafiyetler uygulandı.`,
                ]
              : [],
        },
      },
      { status: 201 }
    );
  }

  return Response.json({ session }, { status: 201 });
}
