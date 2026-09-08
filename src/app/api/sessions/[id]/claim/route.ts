import { NextRequest } from "next/server";
import { validateToken } from "@/lib/token";
import { getSession, claimToken, markAttendance } from "@/lib/db";

// Sunucu UTC çalıştığı için saat dilimi açıkça veriliyor.
const saatBicimi = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * QR ile katılım. Sırayla: oturum açık mı → bu kişinin yoklaması zaten
 * alınmış mı → token geçerli mi → yoklamaya işle.
 *
 * Token kişi başına tek kullanımlıktır (used_tokens birincil anahtarı), ama
 * aynı kodu aynı anda onlarca kişi kullanabilir — ekrandaki QR herkes için
 * aynıdır. Sahte okutmaya karşı koruma token'ın 40 saniyede ölmesidir.
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

  // Yoklaması alınmış kişi, 40 saniye sonraki yeni kodla tekrar giremez.
  // Cihazdaki localStorage koruması yalnızca aynı tarayıcıda işe yarıyordu;
  // asıl kontrol burada.
  const mevcut = session.attendance.find((a) => a.assistantId === assistantId);
  if (mevcut?.status === "var") {
    return Response.json(
      {
        error: `Bu asistanın yoklaması zaten alınmış (${saatBicimi.format(
          new Date(mevcut.timestamp ?? Date.now())
        )}). Değişiklik gerekiyorsa yoklama listesinden yapılabilir.`,
      },
      { status: 409 }
    );
  }

  if (!validateToken(id, token)) {
    return Response.json(
      { error: "QR kodun süresi dolmuş. Ekrandaki kodu tekrar okutun." },
      { status: 401 }
    );
  }

  // Aynı kişi aynı kodu tekrar gönderirse sessizce geçilir — yoklaması zaten
  // işlenmiştir. Başkalarının aynı kodu kullanmasını engellemez: ekrandaki QR'ı
  // aynı anda onlarca kişi okutur.
  await claimToken(id, token, assistantId);

  await markAttendance(id, {
    assistantId,
    status,
    workLocation,
    timestamp: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
