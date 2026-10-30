import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { listDevices, unbindDevice } from "@/lib/db";

export async function GET() {
  return Response.json({ devices: await listDevices() });
}

function sifreDogru(gelen: string, beklenen: string): boolean {
  const a = Buffer.from(gelen);
  const b = Buffer.from(beklenen);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Bir asistanın telefon kaydını kaldırır (telefon değişti, yanlış isim
 * seçildi). Korumasız olsaydı herkes başkasının kaydını silip kendi
 * telefonunu o isme bağlayabilirdi; bu yüzden sunucu tarafında şifre ister.
 * Şifre kodda değil, ADMIN_PASSWORD ortam değişkenindedir.
 */
export async function DELETE(req: NextRequest) {
  const beklenen = process.env.ADMIN_PASSWORD;
  if (!beklenen) {
    return Response.json(
      {
        error:
          "Yönetici şifresi ayarlanmamış. Vercel'de ADMIN_PASSWORD ortam değişkeni tanımlanmalı.",
      },
      { status: 503 }
    );
  }

  const gelen = req.headers.get("x-yonetici-sifre") ?? "";
  if (!sifreDogru(gelen, beklenen)) {
    return Response.json({ error: "Şifre yanlış." }, { status: 401 });
  }

  const asistanId = Number(req.nextUrl.searchParams.get("assistantId"));
  if (!Number.isInteger(asistanId)) {
    return Response.json({ error: "Geçersiz asistan." }, { status: 400 });
  }

  const silindi = await unbindDevice(asistanId);
  return Response.json({ ok: true, silindi });
}
