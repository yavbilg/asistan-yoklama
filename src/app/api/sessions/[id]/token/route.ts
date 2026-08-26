import { NextRequest } from "next/server";
import { generateToken, getSecondsRemaining } from "@/lib/token";
import { getSession } from "@/lib/db";

/**
 * QR ekranının gösterdiği anlık token. Anahtar sunucuda kalır;
 * tarayıcıya yalnızca o anki token iner.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]/token">) {
  const { id } = await ctx.params;

  const session = await getSession(id);
  if (!session) return Response.json({ error: "Oturum bulunamadı." }, { status: 404 });
  if (!session.active) {
    return Response.json({ error: "Oturum kapalı." }, { status: 409 });
  }

  return Response.json(
    { token: generateToken(id), secondsRemaining: getSecondsRemaining() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
