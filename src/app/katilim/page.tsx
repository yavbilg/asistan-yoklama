import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import {
  getSession,
  listAssistants,
  hashDevice,
  getDeviceOwner,
  getPresence,

} from "@/lib/db";
import { validateToken, mintTicket } from "@/lib/token";
import { CIHAZ_CEREZI } from "@/lib/cihaz";
import { katil } from "./actions";
import IsimListesi from "./IsimListesi";
import GonderButonu from "./GonderButonu";

/**
 * QR okutulunca açılan sayfa. Sunucuda çizilir: telefon tek istekte hazır
 * ekranı alır, JavaScript'i ve ayrı API çağrılarını beklemez. Form da
 * JavaScript'siz çalışır.
 *
 * QR kodu burada, sayfa AÇILIRKEN doğrulanır ve sayfaya 5 dakikalık bir
 * bilet gömülür. Kişi isim seçerken ya da bağlantı yavaşken kodun süresi
 * dolsa bile gönderim geçerli olur.
 */

const HATALAR: Record<string, string> = {
  eksik: "Eksik bilgi. Ekrandaki QR kodu tekrar okutun.",
  bilet: "Sayfa çok uzun açık kaldı. Ekrandaki QR kodu tekrar okutun.",
  "oturum-yok": "Bu yoklama oturumu bulunamadı.",
  "oturum-kapali": "Bu yoklama oturumu kapanmış.",
  "telefon-kullanildi": "Bu telefondan bu derste zaten yoklama verildi.",
  sunucu: "Bir hata oluştu. Ekrandaki QR kodu tekrar okutup deneyin.",
};

const SAAT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function trTarih(iso: string): string {
  const [y, a, g] = iso.split("-");
  return `${g}.${a}.${y}`;
}

function tek(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

/* ---------- Ekran parçaları ---------- */

function Kabuk({ children }: { children: React.ReactNode }) {
  return <div className="max-w-lg mx-auto p-4 min-h-screen bg-gray-50">{children}</div>;
}

function DersBasligi({ ad, tarih, bas, bit }: { ad: string; tarih: string; bas: string; bit: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 mb-4 border">
      <h1 className="text-xl font-bold text-gray-900">{ad}</h1>
      <p className="text-gray-500 text-sm">
        {trTarih(tarih)} | {bas} - {bit}
      </p>
    </div>
  );
}

function Durum({
  renk,
  simge,
  baslik,
  children,
}: {
  renk: "yesil" | "kirmizi" | "gri";
  simge: string;
  baslik: string;
  children?: React.ReactNode;
}) {
  const stil = {
    yesil: "bg-green-50 border-green-200 text-green-800",
    kirmizi: "bg-red-50 border-red-200 text-red-800",
    gri: "bg-white border-gray-200 text-gray-800",
  }[renk];
  return (
    <div className={`border-2 rounded-2xl p-8 text-center ${stil}`}>
      <div className="text-5xl mb-3">{simge}</div>
      <h2 className="text-2xl font-bold mb-2">{baslik}</h2>
      {children}
    </div>
  );
}

function HataKutusu({ kod }: { kod: string }) {
  const mesaj = HATALAR[kod];
  if (!mesaj) return null;
  return (
    <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-4 text-sm text-center">
      {mesaj}
    </div>
  );
}

function KatilimFormu({
  s,
  t,
  bilet,
  asistanId,
  dugme,
  aday,
}: {
  s: string;
  t: string;
  bilet: string;
  asistanId: number;
  dugme: string;
  aday?: string;
}) {
  return (
    <form action={katil}>
      <input type="hidden" name="s" value={s} />
      <input type="hidden" name="t" value={t} />
      <input type="hidden" name="bilet" value={bilet} />
      <input type="hidden" name="asistan" value={asistanId} />
      {aday && <input type="hidden" name="aday" value={aday} />}
      <GonderButonu>{dugme}</GonderButonu>
    </form>
  );
}

/* ---------- Sayfa ---------- */

export default async function KatilimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const s = tek(p.s);
  const t = tek(p.t);
  const hata = tek(p.hata);
  // secim parametresi varsa kullanıcı isim seçmek istiyor demektir; hatırlanan
  // isimle gelen tek dokunuşluk ekran atlanır ("Ben değilim" bağlantısı).
  const secimHam = tek(p.secim);
  const secimVar = secimHam !== "";
  const secim = Number(secimHam);

  if (!s) {
    return (
      <Kabuk>
        <Durum renk="gri" simge="⚠" baslik="Geçersiz bağlantı">
          <p>Lütfen ekrandaki QR kodu okutun.</p>
        </Durum>
      </Kabuk>
    );
  }

  const session = await getSession(s);
  if (!session) {
    return (
      <Kabuk>
        <Durum renk="gri" simge="⚠" baslik="Oturum bulunamadı">
          <p>Lütfen ekrandaki QR kodu tekrar okutun.</p>
        </Durum>
      </Kabuk>
    );
  }

  const baslik = (
    <DersBasligi
      ad={session.lessonName}
      tarih={session.date}
      bas={session.startTime}
      bit={session.endTime}
    />
  );

  // Telefon kime kayıtlı?
  const ham = (await cookies()).get(CIHAZ_CEREZI)?.value;
  const sahip = ham ? await getDeviceOwner(hashDevice(ham)) : null;

  // Hatırlanan kişinin yoklaması alınmışsa QR'a bakmadan onay göster.
  // Kullanıcı isim seçmek istediyse (secim) bu kısayol atlanır — telefon
  // başkasının eline geçmiş ya da yanlış isim hatırlanmış olabilir.
  if (sahip && !secimVar) {
    const ne = await getPresence(s, sahip.assistantId);
    if (ne !== null) {
      return (
        <Kabuk>
          {baslik}
          <Durum renk="yesil" simge="✓" baslik="Yoklamanız alındı">
            <p className="text-lg font-medium">{sahip.name}</p>
            {ne && <p className="text-sm mt-1">Saat {SAAT.format(new Date(ne))}</p>}
          </Durum>
        </Kabuk>
      );
    }
  }

  if (!session.active) {
    return (
      <Kabuk>
        {baslik}
        <Durum renk="gri" simge="■" baslik="Oturum kapandı">
          <p>Bu ders için yoklama artık alınmıyor.</p>
        </Durum>
      </Kabuk>
    );
  }

  if (!(await validateToken(s, t))) {
    return (
      <Kabuk>
        {baslik}
        <HataKutusu kod={hata} />
        <Durum renk="kirmizi" simge="⏰" baslik="QR kodun süresi doldu">
          <p>Ekrandaki güncel QR kodu tekrar okutun.</p>
        </Durum>
      </Kabuk>
    );
  }

  const bilet = await mintTicket(s);
  const temelAdres = `/katilim?${new URLSearchParams({ s, t })}`;

  // Hatırlanan isim varsa liste yerine tek düğme. Kullanıcı isim değiştirmek
  // isterse (secim parametresi) bu ekran atlanır.
  if (sahip && !secimVar) {
    return (
      <Kabuk>
        {baslik}
        <HataKutusu kod={hata} />
        <div className="bg-white rounded-2xl p-6 border text-center">
          <p className="text-xl font-semibold text-gray-900 mb-5">{sahip.name}</p>
          <KatilimFormu s={s} t={t} bilet={bilet} asistanId={sahip.assistantId} dugme="Derste Varım" />
          <a href={`${temelAdres}&secim=0`} className="block mt-4 text-sm text-gray-500 underline">
            Ben değilim, isim seç
          </a>
        </div>
      </Kabuk>
    );
  }

  const asistanlar = await listAssistants();

  // İsim seçilmiş: onay ekranı.
  const secilen = asistanlar.find((a) => a.id === secim);
  if (secilen) {
    return (
      <Kabuk>
        {baslik}
        <HataKutusu kod={hata} />
        <div className="bg-white rounded-2xl p-6 border text-center">
          <p className="text-xl font-semibold text-gray-900 mb-5">{secilen.name}</p>
          <KatilimFormu
            s={s}
            t={t}
            bilet={bilet}
            asistanId={secilen.id}
            dugme="Derste Varım"
            aday={randomBytes(32).toString("base64url")}
          />
          <a href={temelAdres} className="block mt-4 text-sm text-gray-500 underline">
            Ben değilim, geri dön
          </a>
        </div>
      </Kabuk>
    );
  }

  const kisiler = asistanlar
    .map((a) => ({ id: a.id, name: a.name }))
    .sort((x, y) => x.name.localeCompare(y.name, "tr"));

  return (
    <Kabuk>
      {baslik}
      <HataKutusu kod={hata} />
      <p className="text-sm text-gray-600 mb-3">Adınızı seçin.</p>
      <IsimListesi kisiler={kisiler} temelAdres={temelAdres} />
    </Kabuk>
  );
}
