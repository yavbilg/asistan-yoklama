import { NextRequest } from "next/server";
import { getSession, endSession } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) return Response.json({ error: "Oturum bulunamadı." }, { status: 404 });
  return Response.json({ session });
}

/** Şimdilik tek işlem: oturumu kapatmak. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  if (body?.active === false) {
    await endSession(id);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Desteklenmeyen güncelleme." }, { status: 400 });
}
