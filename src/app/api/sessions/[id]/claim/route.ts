import { NextRequest } from "next/server";
import { validateToken } from "@/lib/token";
import { getSession, claimToken, markAttendance } from "@/lib/db";

/**
 * QR ile katılım. Sırayla: oturum açık mı → token geçerli mi →
 * token daha önce kullanılmış mı → yoklamaya işle.
 *
 * Tek kullanım kontrolü veritabanındaki PRIMARY KEY ile yapılır,
 * yani iki kişi aynı anda aynı token'ı gönderirse yalnızca biri geçer.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/claim">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  const token = typeof body?.token === "string" ? body.token : "";
  const assistantId = Number(body?.assistantId);
  const workLocation = typeof body?.workLocation === "string" ? body.workLocation : "";
  // Katılan kişi kendini "var" ya da bir çalışma yeriyle "muaf" işaretleyebilir.
  const status = body?.status === "muaf" ? "muaf" : "var";

  if (!token || !Number.isInteger(assistantId)) {
    return Response.json({ error: "Eksik bilgi." }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) return Response.json({ error: "Oturum bulunamadı." }, { status: 404 });
  if (!session.active) {
    return Response.json({ error: "Bu oturum kapanmış." }, { status: 409 });
  }

  if (!validateToken(id, token)) {
    return Response.json(
      { error: "QR kodun süresi dolmuş. Ekrandaki kodu tekrar okutun." },
      { status: 401 }
    );
  }

  if (!(await claimToken(id, token))) {
    return Response.json(
      { error: "Bu kod zaten kullanılmış. Ekrandaki yeni kodu okutun." },
      { status: 409 }
    );
  }

  await markAttendance(id, {
    assistantId,
    status,
    workLocation,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
