import { NextRequest } from "next/server";
import { updateAssistant, deactivateAssistant } from "@/lib/db";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/assistants/[id]">) {
  const { id } = await ctx.params;
  const assistantId = Number(id);
  if (!Number.isInteger(assistantId)) {
    return Response.json({ error: "Geçersiz id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Geçersiz istek." }, { status: 400 });

  await updateAssistant(assistantId, {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    endDate: typeof body.endDate === "string" ? body.endDate.trim() : undefined,
    active: typeof body.active === "boolean" ? body.active : undefined,
  });
  return Response.json({ ok: true });
}

/** Kayıt silinmez, pasife alınır — geçmiş yoklamalar bozulmasın. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/assistants/[id]">) {
  const { id } = await ctx.params;
  const assistantId = Number(id);
  if (!Number.isInteger(assistantId)) {
    return Response.json({ error: "Geçersiz id." }, { status: 400 });
  }
  await deactivateAssistant(assistantId);
  return Response.json({ ok: true });
}
