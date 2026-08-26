import { NextRequest } from "next/server";
import { getSession, listAssistants } from "@/lib/db";
import { sessionWorkbook, trDate } from "@/lib/excel";

function asciiFallback(s: string): string {
  const map: Record<string, string> = {
    ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I",
    ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
  };
  return s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => map[c]).replace(/[^\x20-\x7E]/g, "_");
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/export">) {
  const { id } = await ctx.params;

  const session = await getSession(id);
  if (!session) return Response.json({ error: "Oturum bulunamadı." }, { status: 404 });

  const assistants = await listAssistants(true);
  const buffer = await sessionWorkbook(session, assistants);

  const name = `${session.lessonName} ${trDate(session.date)}.xlsx`;
  // Türkçe karakterli dosya adı için hem ASCII yedeği hem UTF-8 sürümü gönderilir.
  const disposition =
    `attachment; filename="${asciiFallback(name)}"; ` +
    `filename*=UTF-8''${encodeURIComponent(name)}`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
    },
  });
}
