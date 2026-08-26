import { NextRequest } from "next/server";
import { listSessions, getSession, listAssistants, Session } from "@/lib/db";
import { overallWorkbook } from "@/lib/excel";

/**
 * Dönem raporu.  /api/export?from=2026-01-01&to=2026-06-30
 * Tarih verilmezse tüm oturumlar.
 */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return Response.json({ error: "Tarih YYYY-AA-GG olmalı." }, { status: 400 });
  }

  const summaries = await listSessions(500);
  const selected = summaries.filter(
    (s) => (!from || s.date >= from) && (!to || s.date <= to)
  );

  if (selected.length === 0) {
    return Response.json({ error: "Seçilen aralıkta oturum yok." }, { status: 404 });
  }

  const [assistants, sessions] = await Promise.all([
    listAssistants(true),
    Promise.all(selected.map((s) => getSession(s.id))),
  ]);

  const buffer = await overallWorkbook(
    sessions.filter((s): s is Session => s !== null),
    assistants
  );

  const suffix = from || to ? `-${from || "basi"}_${to || "sonu"}` : "";
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="yoklama-raporu${suffix}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
