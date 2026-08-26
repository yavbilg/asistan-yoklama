import { NextRequest } from "next/server";
import { listNameAliases, setNameAlias, deleteNameAlias } from "@/lib/db";

export async function GET() {
  return Response.json({ aliases: await listNameAliases() });
}

/**
 * Bir yazımı asistana bağlar.
 *   { alias: "BETUL", assistantId: 35 }   → o kişiye eşle
 *   { alias: "HALIL", assistantId: null } → asistan değil, yok say
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const alias = typeof body?.alias === "string" ? body.alias.trim() : "";
  if (!alias) return Response.json({ error: "Yazım gerekli." }, { status: 400 });

  const ham = body?.assistantId;
  if (ham !== null && !Number.isInteger(ham)) {
    return Response.json({ error: "Geçersiz asistan." }, { status: 400 });
  }

  await setNameAlias(alias, ham as number | null);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const alias = req.nextUrl.searchParams.get("alias");
  if (!alias) return Response.json({ error: "Yazım gerekli." }, { status: 400 });
  await deleteNameAlias(alias);
  return Response.json({ ok: true });
}
