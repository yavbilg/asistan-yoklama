// SUNUCUYA ÖZEL: bu dosya client bileşenlerinden import edilmemeli.
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

/**
 * QR ve katılım bileti imzalama.
 *
 * Önceki sürümün iki açığı vardı:
 *  1. Anahtar TOKEN_SECRET tanımlı değilse koddaki sabit bir değere
 *     düşüyordu; canlıda tanımlı değildi ve o değer GitHub'da açıktı.
 *  2. Kullanılan "hash" doğrusal bir sağlama toplamıydı (String.hashCode
 *     benzeri). Tek bir gözlenmiş token'dan, anahtar bilinmeden sonrakiler
 *     türetilebiliyordu.
 * Şimdi HMAC-SHA256 kullanılıyor ve anahtar ya ortam değişkeninden ya da
 * veritabanında bir kez rastgele üretilen değerden geliyor — kodda yok.
 */

/** Ekrandaki QR bu sıklıkla yenilenir. */
export const QR_ARALIK_MS = 20_000;

/**
 * Okutulan kod, üretildiği dilim ve önceki iki dilim boyunca geçerlidir
 * (en az 40, en fazla 60 sn). Doğrulama gönderimde değil SAYFA AÇILIRKEN
 * yapılır; sonrasında kişinin elinde 5 dakikalık bilet olur. Böylece kod
 * kısa ömürlü kalırken yavaş açılan telefonlar da süre aşımına düşmez.
 */
const GECERLI_ONCEKI_DILIM = 2;

/** Sayfa açıldıktan sonra "Derste varım"a basmak için süre. */
const BILET_OMRU_MS = 5 * 60_000;

let onbellek: Buffer | null = null;

async function anahtar(): Promise<Buffer> {
  if (onbellek) return onbellek;

  const ortam = process.env.TOKEN_SECRET;
  if (ortam && ortam.length >= 16) {
    onbellek = Buffer.from(ortam, "utf8");
    return onbellek;
  }

  // Ortam değişkeni yoksa veritabanında bir kez üret, hep onu kullan.
  // ON CONFLICT: aynı anda iki örnek açılırsa ikisi de aynı değeri okur.
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('token_secret', ${randomBytes(32).toString("base64url")})
    ON CONFLICT (key) DO NOTHING
  `;
  const [satir] = await sql`SELECT value FROM app_settings WHERE key = 'token_secret'`;
  onbellek = Buffer.from(satir.value as string, "utf8");
  return onbellek;
}

async function imza(icerik: string, uzunluk: number): Promise<string> {
  return createHmac("sha256", await anahtar())
    .update(icerik)
    .digest("base64url")
    .slice(0, uzunluk);
}

function esit(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function dilim(simdi = Date.now()): number {
  return Math.floor(simdi / QR_ARALIK_MS);
}

/* ---------- Ekrandaki QR kodu ---------- */

export async function generateToken(sessionId: string): Promise<string> {
  return imza(`qr|${sessionId}|${dilim()}`, 16);
}

export async function validateToken(sessionId: string, token: string): Promise<boolean> {
  if (!token || token.length !== 16) return false;
  const simdiki = dilim();
  for (let geri = 0; geri <= GECERLI_ONCEKI_DILIM; geri++) {
    if (esit(token, await imza(`qr|${sessionId}|${simdiki - geri}`, 16))) return true;
  }
  return false;
}

export function getSecondsRemaining(): number {
  const simdi = Date.now();
  return Math.ceil(((dilim(simdi) + 1) * QR_ARALIK_MS - simdi) / 1000);
}

/* ---------- Katılım bileti ---------- */

/** QR doğrulandığında sayfaya gömülür; form gönderilirken geri gelir. */
export async function mintTicket(sessionId: string): Promise<string> {
  const zaman = Date.now();
  return `${zaman}.${await imza(`bilet|${sessionId}|${zaman}`, 22)}`;
}

export async function verifyTicket(sessionId: string, bilet: string): Promise<boolean> {
  const [zamanHam, imzaHam] = String(bilet ?? "").split(".");
  const zaman = Number(zamanHam);
  if (!Number.isFinite(zaman) || !imzaHam) return false;

  const yas = Date.now() - zaman;
  if (yas < -30_000 || yas > BILET_OMRU_MS) return false;

  return esit(imzaHam, await imza(`bilet|${sessionId}|${zaman}`, 22));
}
