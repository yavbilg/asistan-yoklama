"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WORK_LOCATIONS, isExempt } from "@/lib/assistants";
import {
  Assistant,
  AttendanceRecord,
  Session,
  Status,
  fetchSession,
  fetchAssistants,
  markOne,
  markMany,
  trTarih,
  saat,
} from "@/lib/api";

// NOT: bu parola tarayıcı paketinde açık durur, yalnızca yanlışlıkla
// işaretlemeyi engeller. Gerçek koruma sunucu tarafında yapılmalı.
const ADMIN_PASSWORD = "SakaryaPsikiyatri";

type Filtre = "all" | Status;

export default function YoklamaListePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [filter, setFilter] = useState<Filtre>("all");
  const [arama, setArama] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [hata, setHata] = useState("");

  // Kaydedilmeyi bekleyen yazma sayısı. Sıfır değilken arka plan yenilemesi
  // yapılmaz, yoksa henüz sunucuya ulaşmamış tıklamalar geri alınmış görünür.
  const bekleyen = useRef(0);

  const yenile = useCallback(async () => {
    if (bekleyen.current > 0) return;
    try {
      const s = await fetchSession(sessionId);
      setSession(s);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Oturum yüklenemedi.");
    }
  }, [sessionId]);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const liste = await fetchAssistants(true);
        if (!iptal) setAssistants(liste);
      } catch {
        // İsimler gelmezse tablo id ile çalışmaya devam eder.
      }
    })();

    const ilk = setTimeout(yenile, 0);
    const t = setInterval(yenile, 10000);
    return () => {
      iptal = true;
      clearTimeout(ilk);
      clearInterval(t);
    };
  }, [yenile]);

  const handleUnlock = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setUnlocked(true);
      setPasswordInput("");
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  /**
   * İyimser güncelleme: ekran hemen değişir, kayıt arka planda gider.
   * Hata olursa eski hâle dönülür — kullanıcı yanlış bilgiye bakmasın.
   */
  const kaydet = async (rec: AttendanceRecord) => {
    if (!session) return;
    const oncesi = session;

    setSession({
      ...session,
      attendance: session.attendance.map((a) =>
        a.assistantId === rec.assistantId ? rec : a
      ),
    });
    setHata("");

    bekleyen.current++;
    try {
      await markOne(sessionId, rec);
    } catch (e) {
      setSession(oncesi);
      setHata(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      bekleyen.current--;
    }
  };

  const durumDegistir = (record: AttendanceRecord) => {
    const yeni: AttendanceRecord =
      record.status === "var"
        ? { assistantId: record.assistantId, status: "yok" }
        : {
            assistantId: record.assistantId,
            status: "var",
            timestamp: new Date().toISOString(),
          };
    kaydet(yeni);
  };

  const muafYap = (assistantId: number, location: string) =>
    kaydet({
      assistantId,
      status: "muaf",
      workLocation: location,
      timestamp: new Date().toISOString(),
    });

  /** Görünen kişilerin tamamını tek istekte işaretler. */
  const topluIsaretle = async (status: Status) => {
    if (!session) return;
    const hedef = gosterilen.map((r) => r.assistantId);
    if (hedef.length === 0) return;
    if (!confirm(`${hedef.length} kişi "${status.toUpperCase()}" olarak işaretlensin mi?`))
      return;

    const oncesi = session;
    const stamp = new Date().toISOString();
    const kayitlar: AttendanceRecord[] = hedef.map((id) => ({
      assistantId: id,
      status,
      timestamp: status === "yok" ? undefined : stamp,
    }));

    setSession({
      ...session,
      attendance: session.attendance.map((a) => {
        const y = kayitlar.find((k) => k.assistantId === a.assistantId);
        return y ?? a;
      }),
    });

    bekleyen.current++;
    try {
      await markMany(sessionId, kayitlar);
    } catch (e) {
      setSession(oncesi);
      setHata(e instanceof Error ? e.message : "Toplu işaretleme başarısız.");
    } finally {
      bekleyen.current--;
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">{hata || "Yükleniyor…"}</p>
      </div>
    );
  }

  const isim = new Map(assistants.map((a) => [a.id, a.name]));
  const sayim = session.attendance.reduce(
    (acc, a) => ({ ...acc, [a.status]: acc[a.status] + 1 }),
    { var: 0, yok: 0, muaf: 0 } as Record<Status, number>
  );

  const gosterilen = session.attendance
    .filter((a) => filter === "all" || a.status === filter)
    .filter((a) =>
      arama.trim()
        ? (isim.get(a.assistantId) ?? "").toLocaleLowerCase("tr").includes(
            arama.trim().toLocaleLowerCase("tr")
          )
        : true
    );

  const kutu = (etiket: string, deger: number, f: Filtre, renk: string, sinir: string) => (
    <button
      onClick={() => setFilter(f)}
      className={`rounded-lg p-3 text-center border ${
        filter === f ? `${sinir} bg-opacity-50` : "bg-white"
      }`}
    >
      <div className={`text-2xl font-bold ${renk}`}>{deger}</div>
      <div className="text-xs text-gray-500">{etiket}</div>
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
          &larr; Ana Sayfa
        </Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{session.lessonName}</h1>
            <p className="text-gray-500">
              {trTarih(session.date)} | {session.startTime} - {session.endTime}
              {session.active && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Aktif
                </span>
              )}
            </p>
          </div>
          <a
            href={`/api/sessions/${session.id}/export`}
            className="text-sm bg-green-700 text-white px-3 py-2 rounded-lg hover:bg-green-800 whitespace-nowrap"
          >
            Excel
          </a>
        </div>
      </div>

      {hata && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {hata}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-4">
        {kutu("Toplam", session.attendance.length, "all", "text-gray-900", "border-blue-500 bg-blue-50")}
        {kutu("Var", sayim.var, "var", "text-green-600", "border-green-500 bg-green-50")}
        {kutu("Yok", sayim.yok, "yok", "text-red-600", "border-red-500 bg-red-50")}
        {kutu("Muaf", sayim.muaf, "muaf", "text-yellow-600", "border-yellow-500 bg-yellow-50")}
      </div>

      <input
        type="search"
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        placeholder="İsimle ara…"
        className="w-full border rounded-lg px-3 py-2 text-gray-900 mb-4"
      />

      {session.active && !unlocked && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800 font-medium mb-3">
            Yoklama işlemleri için şifre gereklidir
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Şifre giriniz"
              className={`border rounded-lg px-3 py-2 text-sm flex-1 text-gray-900 ${
                passwordError ? "border-red-400 bg-red-50" : ""
              }`}
            />
            <button
              onClick={handleUnlock}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 text-sm font-medium"
            >
              Kilidi Aç
            </button>
          </div>
          {passwordError && <p className="text-xs text-red-600 mt-1">Yanlış şifre</p>}
        </div>
      )}

      {session.active && unlocked && (
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => topluIsaretle("var")}
              className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-lg hover:bg-green-200"
            >
              Görünenleri Var yap
            </button>
            <button
              onClick={() => topluIsaretle("yok")}
              className="text-xs bg-red-100 text-red-800 px-3 py-1.5 rounded-lg hover:bg-red-200"
            >
              Görünenleri Yok yap
            </button>
          </div>
          <button
            onClick={() => setUnlocked(false)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Kilitle
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">#</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                Ad Soyad
              </th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">
                Durum
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 hidden sm:table-cell">
                Çalışma Yeri
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 hidden sm:table-cell">
                Saat
              </th>
              {session.active && unlocked && (
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">
                  İşlem
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {gosterilen.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  Eşleşen kayıt yok.
                </td>
              </tr>
            )}
            {gosterilen.map((record, index) => (
              <tr key={record.assistantId} className="border-b last:border-0">
                <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {isim.get(record.assistantId) ?? `#${record.assistantId}`}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block text-xs font-bold px-2 py-1 rounded ${
                      record.status === "var"
                        ? "bg-green-100 text-green-800"
                        : record.status === "muaf"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {record.status === "var"
                      ? "VAR"
                      : record.status === "muaf"
                      ? `MUAF${record.workLocation ? ` (${record.workLocation})` : ""}`
                      : "YOK"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                  {record.workLocation || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                  {saat(record.timestamp)}
                </td>
                {session.active && unlocked && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => durumDegistir(record)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        {record.status === "var" ? "Yok Yap" : "Var Yap"}
                      </button>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            muafYap(record.assistantId, e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="text-xs border rounded px-1 py-1 text-gray-600"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Muaf
                        </option>
                        {WORK_LOCATIONS.filter((l) => isExempt(l)).map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
