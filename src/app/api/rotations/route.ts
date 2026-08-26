import { NextRequest } from "next/server";
import { listAssistants, replaceRotations, listRotationPeriods } from "@/lib/db";
import { parseRotationWorkbook } from "@/lib/rotation-excel";

export const maxDuration = 60;

const MAX_BOYUT = 10 * 1024 * 1024;

export async function GET() {
  return Response.json({ periods: await listRotationPeriods() });
}

/**
 *   POST /api/rotations            → önizleme
 *   POST /api/rotations?commit=1   → kaydet
 */
export async function POST(req: NextRequest) {
  const commit = req.nextUrl.searchParams.get("commit") === "1";

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Dosya gönderilmedi." }, { status: 400 });
  }
  if (file.size > MAX_BOYUT) {
    return Response.json({ error: "Dosya 10 MB'tan büyük." }, { status: 400 });
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return Response.json({ error: "Yalnızca .xlsx dosyası kabul edilir." }, { status: 400 });
  }

  const assistants = await listAssistants();

  let sonuc;
  try {
    sonuc = await parseRotationWorkbook(await file.arrayBuffer(), assistants);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Dosya okunamadı." },
      { status: 400 }
    );
  }

  const ozet = {
    monthLabel: sonuc.monthLabel,
    startDate: sonuc.startDate,
    endDate: sonuc.endDate,
    entries: sonuc.entries,
    unresolved: sonuc.unresolved,
    skippedUnits: sonuc.skippedUnits,
  };

  if (!commit) return Response.json({ preview: true, ...ozet });

  const yazilan = await replaceRotations(
    sonuc.entries.map((e) => ({
      assistantId: e.assistantId,
      unit: e.unit,
      workLocation: e.workLocation,
    })),
    sonuc.startDate,
    sonuc.endDate,
    file.name
  );

  return Response.json({ saved: true, ...ozet, written: yazilan });
}
