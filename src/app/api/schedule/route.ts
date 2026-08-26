import { NextRequest } from "next/server";
import {
  listAssistants,
  getNameAliases,
  replaceDutyAssignments,
  listDutyDays,
} from "@/lib/db";
import { parseScheduleWorkbook, exemptOnly } from "@/lib/schedule-excel";

// Excel ayrıştırma birkaç saniye sürebilir.
export const maxDuration = 60;

const MAX_BOYUT = 10 * 1024 * 1024; // 10 MB

export async function GET() {
  return Response.json({ days: await listDutyDays() });
}

/**
 * Çizelge dosyasını okur.
 *   POST /api/schedule            → yalnızca önizleme, hiçbir şey kaydedilmez
 *   POST /api/schedule?commit=1   → ayrıştırıp veritabanına yazar
 *
 * İki adım ayrı: kullanıcı neyin yazılacağını görmeden kayıt yapılmıyor.
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

  const [assistants, aliases] = await Promise.all([listAssistants(), getNameAliases()]);

  let sonuc;
  try {
    sonuc = await parseScheduleWorkbook(await file.arrayBuffer(), assistants, aliases);
  } catch {
    return Response.json(
      { error: "Dosya okunamadı. Geçerli bir .xlsx dosyası mı?" },
      { status: 400 }
    );
  }

  if (sonuc.dates.length === 0) {
    return Response.json(
      { error: "Dosyada tarih hücresi bulunamadı. Doğru çizelge dosyası mı?" },
      { status: 400 }
    );
  }

  const muaf = exemptOnly(sonuc.duties);

  // Aynı kişi aynı gün birden çok görevde görünebilir (örn. hem poliklinik hem
  // nöbet ertesi). Sonuncusu geçerli sayılır; kişi zaten muaf olacak.
  const benzersiz = new Map<string, (typeof muaf)[number]>();
  for (const d of muaf) benzersiz.set(`${d.date}|${d.assistantId}`, d);
  const yazilacak = [...benzersiz.values()];

  const ozet = {
    dates: sonuc.dates,
    sheetNames: sonuc.sheetNames,
    totalDuties: sonuc.duties.length,
    exemptRecords: yazilacak.length,
    peopleCount: new Set(yazilacak.map((d) => d.assistantId)).size,
    unresolved: sonuc.unresolved,
    unknownLabels: sonuc.unknownLabels,
    // Önizlemede ilk günün dökümü — kullanıcı gözüyle doğrulasın diye.
    sample: yazilacak
      .filter((d) => d.date === sonuc.dates[0])
      .map((d) => ({ name: d.assistantName, location: d.workLocation, label: d.label })),
  };

  if (!commit) {
    return Response.json({ preview: true, ...ozet });
  }

  const yazim = await replaceDutyAssignments(
    yazilacak.map((d) => ({
      date: d.date,
      assistantId: d.assistantId,
      workLocation: d.workLocation,
    })),
    file.name
  );

  return Response.json({ saved: true, ...ozet, written: yazim });
}
