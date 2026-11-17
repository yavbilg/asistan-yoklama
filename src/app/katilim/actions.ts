"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { verifyTicket } from "@/lib/token";
import {
  getSession,
  listAssistants,
  hashDevice,
  rememberDevice,
  getPresence,
  claimViaQr,
} from "@/lib/db";
import { CIHAZ_CEREZI } from "@/lib/cihaz";

const IKI_YIL = 60 * 60 * 24 * 365 * 2;

/**
 * "Derste varım" formu. JavaScript yüklenmemiş olsa bile çalışır (sunucu
 * bileşenindeki form). Sonuç her durumda bir yönlendirmedir: başarıda
 * onay ekranına, hatada aynı sayfaya hata koduyla.
 */
export async function katil(form: FormData): Promise<void> {
  const s = String(form.get("s") ?? "");
  const t = String(form.get("t") ?? "");

  let hedef: string;
  try {
    hedef = await isle(form, s);
  } catch {
    hedef = hataAdresi(s, t, "sunucu");
  }
  // redirect bir istisna fırlatır; try bloğunun dışında çağrılmalı.
  redirect(hedef);
}

function hataAdresi(s: string, t: string, hata: string): string {
  return `/katilim?${new URLSearchParams({ s, t, hata })}`;
}

async function isle(form: FormData, s: string): Promise<string> {
  const t = String(form.get("t") ?? "");
  const bilet = String(form.get("bilet") ?? "");
  const asistanId = Number(form.get("asistan"));
  const hata = (kod: string) => hataAdresi(s, t, kod);
  const onay = `/katilim?${new URLSearchParams({ s })}`;

  if (!s || !Number.isInteger(asistanId)) return hata("eksik");

  // Bilet, QR'ın sayfa açılırken doğrulandığının kanıtı. 5 dakika geçerli.
  if (!(await verifyTicket(s, bilet))) return hata("bilet");

  const session = await getSession(s);
  if (!session) return hata("oturum-yok");
  if (!session.active) return hata("oturum-kapali");

  const asistanlar = await listAssistants();
  if (!asistanlar.some((a) => a.id === asistanId)) return hata("eksik");

  const cerezler = await cookies();
  let ham = cerezler.get(CIHAZ_CEREZI)?.value;
  let yeniCerez = false;
  if (!ham) {
    // Aday kimlik onay sayfasında üretilip forma konuyor. Çift dokunuşta iki
    // istek aynı kimliği taşır; ikincisi kendi kaydını tanır ve hata vermez.
    const aday = String(form.get("aday") ?? "");
    ham = /^[A-Za-z0-9_-]{43}$/.test(aday) ? aday : randomBytes(32).toString("base64url");
    yeniCerez = true;
  }
  const idHash = hashDevice(ham);

  // Telefon–isim eşleşmesi ARTIK KİLİT DEĞİL, yalnızca hatırlatmadır.
  // Kalıcı bağlama denendi ve haftalık kullanımda kırıldı: çerez iki ders
  // arasında silinince (Safari temizliği, gizli sekme, bağlantının başka bir
  // uygulamanın içindeki tarayıcıda açılması) kişi kendi adına bir daha
  // yoklama veremiyordu. 21 kayıtlı telefonun 14'ü böyle kilitlendi.
  // Farklı bir isim seçilirse kayıt sessizce güncellenir.
  const ua = (await headers()).get("user-agent") ?? "";
  await rememberDevice(idHash, asistanId, ua);

  if (yeniCerez) {
    cerezler.set(CIHAZ_CEREZI, ham, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: IKI_YIL,
    });
  }

  // Yoklaması zaten alınmışsa (QR ya da yönetici eliyle) yeniden yazma.
  if ((await getPresence(s, asistanId)) !== null) return onay;

  const sonuc = await claimViaQr(s, asistanId, idHash);
  // Tek kalan sınır: bir telefon aynı derste yalnızca bir kişi için yoklama
  // verebilir. Bu, bir kişinin arkadaşlarını da işaretlemesini engeller.
  if (!sonuc.ok && sonuc.sebep === "telefon-zaten") return hata("telefon-kullanildi");

  return onay;
}
