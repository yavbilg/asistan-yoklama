import { NextRequest } from "next/server";
import { listAssistants, createAssistant } from "@/lib/db";

export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  const assistants = await listAssistants(includeInactive);
  return Response.json({ assistants });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "Ad soyad gerekli." }, { status: 400 });
  }
  const endDate = typeof body?.endDate === "string" ? body.endDate.trim() : "";
  const assistant = await createAssistant(name, endDate);
  return Response.json({ assistant }, { status: 201 });
}
