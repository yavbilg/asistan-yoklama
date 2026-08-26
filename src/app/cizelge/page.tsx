"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Assistant, fetchAssistants, trTarih } from "@/lib/api";

/* ---------- Tipler ---------- */

interface Unresolved {
  token: string;
  reason: "belirsiz" | "taninmiyor";
  candidates: { id: number; name: string }[];
  count: number;
  examples: string[];
}

interface DutyPreview {
  dates: string[];
  exemptRecords: number;
  peopleCount: number;
  unresolved: Unresolved[];
  unknownLabels: { label: string; count: number; example: string }[];
  sample: { name: string; location: string; label: string }[];
  saved?: boolean;
  written?: { days: number; records: number };
}

interface RotationPreview {
  monthLabel: string;
  startDate: string;
  endDate: string;
  entries: { assistantId: number; assistantName: string; unit: string; workLocation: string }[];
  unresolved: { token: string; unit: string; candidates: { id: number; name: string }[] }[];
  skippedUnits: { unit: string; people: number }[];
  saved?: boolean;
  written?: number;
}

interface DutyDay {
  date: string;
  count: number;
  source: string | null;
}
interface Period {
  startDate: string;
  endDate: string;
  count: number;
  source: string | null;
}

/* ---------- Ortak parçalar ---------- */

function Kutu({
  deger,
  etiket,
  vurgu,
}: {
  deger: number | string;
  etiket: string;
  vurgu?: "iyi" | "dikkat";
}) {
  const renk =
    vurgu === "dikkat"
      ? "text-yellow-600"
      : vurgu === "iyi"
      ? "text-green-600"
      : "text-gray-900";
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${renk}`}>{deger}</div>
      <div className="text-xs text-gray-500">{etiket}</div>
    </div>
  );
}

function DosyaSecici({
  id,
  aciklama,
  dosya,
  onSec,
  onOnizle,
  onKaydet,
  kaydedilebilir,
  calisiyor,
}: {
  id: string;
  aciklama: string;
  dosya: File | null;
  onSec: (f: File | null) => void;
  onOnizle: () => void;
  onKaydet: () => void;
  kaydedilebilir: boolean;
  calisiyor: boolean;
}) {
  return (
    <>
      <p className="text-sm text-gray-500 mb-3">{aciklama}</p>
      <input
        id={id}
        type="file"
        accept=".xlsx"
        onChange={(e) => onSec(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4
                   file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700
                   hover:file:bg-gray-200"
      />
      {dosya && (
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <button
            onClick={onOnizle}
            disabled={calisiyor}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {calisiyor ? "Okunuyor…" : "Önizle"}
          </button>
          {kaydedilebilir && (
            <button
              onClick={onKaydet}
              disabled={calisiyor}
              className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm font-medium disabled:opacity-50"
            >
              Kaydet
            </button>
          )}
          <span className="text-xs text-gray-500 truncate max-w-[220px]">{dosya.name}</span>
        </div>
      )}
    </>
  );
}

/* ---------- Sayfa ---------- */

export default function CizelgePage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [gunler, setGunler] = useState<DutyDay[]>([]);
  const [donemler, setDonemler] = useState<Period[]>([]);

  const [rotDosya, setRotDosya] = useState<File | null>(null);
  const [rotOnizleme, setRotOnizleme] = useState<RotationPreview | null>(null);

  const [gunDosya, setGunDosya] = useState<File | null>(null);
  const [gunOnizleme, setGunOnizleme] = useState<DutyPreview | null>(null);

  const [mesaj, setMesaj] = useState("");
  const [hata, setHata] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);

  const durumYukle = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/schedule").then((r) => r.json()),
        fetch("/api/rotations").then((r) => r.json()),
      ]);
      setGunler(a.days ?? []);
      setDonemler(b.periods ?? []);
    } catch {
      // durum gelmezse sayfa yine kullanılabilir
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchAssistants(true).then(setAssistants).catch(() => {});
      durumYukle();
    }, 0);
    return () => clearTimeout(t);
  }, [durumYukle]);

  const gonder = async (
    tur: "rotations" | "schedule",
    dosya: File | null,
    commit: boolean
  ) => {
    if (!dosya || calisiyor) return;
    setCalisiyor(true);
    setHata("");
    setMesaj("");

    const fd = new FormData();
    fd.append("file", dosya);

    try {
      const r = await fetch(`/api/${tur}${commit ? "?commit=1" : ""}`, {
        method: "POST",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) {
        setHata(d.error ?? "Dosya işlenemedi.");
        return;
      }
      if (tur === "rotations") setRotOnizleme(d);
      else setGunOnizleme(d);

      if (commit) {
        setMesaj(
          tur === "rotations"
            ? `Rotasyon kaydedildi: ${d.monthLabel}, ${d.written} kişi.`
            : `Günlük çizelge kaydedildi: ${d.written.days} gün, ${d.written.records} kayıt.`
        );
        await durumYukle();
      }
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Yükleme başarısız.");
    } finally {
      setCalisiyor(false);
    }
  };

  const esle = async (alias: string, assistantId: number | null) => {
    try {
      await fetch("/api/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, assistantId }),
      });
      await gonder("schedule", gunDosya, false);
    } catch {
      setHata("Eşleme kaydedilemedi.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
        &larr; Ana Sayfa
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-1 mb-1">Aylık Yükleme</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Her ay başında iki dosya yüklenir. Oturum açılırken muafiyetler bu iki
        kaynaktan otomatik işlenir; dışarıya hiçbir bağlantı kurulmaz.
      </p>

      {hata && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {hata}
        </div>
      )}
      {mesaj && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">
          {mesaj}
        </div>
      )}

      {/* ---------- 1. Dış rotasyon ---------- */}
      <div className="bg-white border rounded-xl p-4 mb-4">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h2 className="font-semibold text-gray-900">1 · Dış Rotasyon</h2>
          <span className="text-xs text-gray-400">rotasyon.xlsx</span>
        </div>
        <DosyaSecici
          id="rot"
          aciklama="Kimin o ay hangi birimde olduğu. Nöroloji, Çoc. Psikiyatrisi, TRSM ve İzin/Rapor'daki asistanlar tüm ay boyunca muaf sayılır."
          dosya={rotDosya}
          onSec={(f) => {
            setRotDosya(f);
            setRotOnizleme(null);
            setMesaj("");
            setHata("");
          }}
          onOnizle={() => gonder("rotations", rotDosya, false)}
          onKaydet={() => gonder("rotations", rotDosya, true)}
          kaydedilebilir={!!rotOnizleme && !rotOnizleme.saved}
          calisiyor={calisiyor}
        />

        {rotOnizleme && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-900">
                {rotOnizleme.monthLabel}
                <span className="text-gray-500 font-normal text-sm">
                  {" "}
                  ({trTarih(rotOnizleme.startDate)} – {trTarih(rotOnizleme.endDate)})
                </span>
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  rotOnizleme.saved
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {rotOnizleme.saved ? "kaydedildi" : "önizleme"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <Kutu deger={rotOnizleme.entries.length} etiket="muaf asistan" vurgu="iyi" />
              <Kutu
                deger={rotOnizleme.unresolved.length}
                etiket="çözülemeyen"
                vurgu={rotOnizleme.unresolved.length ? "dikkat" : "iyi"}
              />
              <Kutu
                deger={rotOnizleme.skippedUnits.reduce((t, s) => t + s.people, 0)}
                etiket="muaf sayılmayan"
              />
            </div>

            {rotOnizleme.entries.length > 0 && (
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <tbody>
                    {rotOnizleme.entries.map((e) => (
                      <tr key={e.assistantId} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 text-gray-900">{e.assistantName}</td>
                        <td className="py-1.5 pr-3 text-gray-600">{e.unit}</td>
                        <td className="py-1.5 text-gray-400 text-xs">{e.workLocation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rotOnizleme.unresolved.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-sm">
                <p className="font-medium text-yellow-900 mb-1">Eşleşmeyen isimler</p>
                <ul className="text-yellow-900 space-y-0.5">
                  {rotOnizleme.unresolved.map((u, i) => (
                    <li key={i}>
                      <span className="font-medium">{u.token}</span> ({u.unit})
                      {u.candidates.length > 0 && (
                        <span className="text-yellow-700">
                          {" "}
                          — aday: {u.candidates.map((c) => c.name).join(" / ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rotOnizleme.skippedUnits.length > 0 && (
              <details className="text-sm text-gray-600">
                <summary className="cursor-pointer">
                  Muaf sayılmayan birimler ({rotOnizleme.skippedUnits.length})
                </summary>
                <ul className="mt-2 space-y-0.5 text-gray-500">
                  {rotOnizleme.skippedUnits.map((s) => (
                    <li key={s.unit}>
                      {s.unit} — {s.people} kişi
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ---------- 2. Günlük çalışma yerleri ---------- */}
      <div className="bg-white border rounded-xl p-4 mb-4">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h2 className="font-semibold text-gray-900">2 · Günlük Çalışma Yerleri</h2>
          <span className="text-xs text-gray-400">doktor.xlsx</span>
        </div>
        <DosyaSecici
          id="gun"
          aciklama="Gün gün nöbet ertesi, izin, poliklinik, konsültasyon görevleri. O gün ders varsa ilgili kişiler otomatik muaf işaretlenir."
          dosya={gunDosya}
          onSec={(f) => {
            setGunDosya(f);
            setGunOnizleme(null);
            setMesaj("");
            setHata("");
          }}
          onOnizle={() => gonder("schedule", gunDosya, false)}
          onKaydet={() => gonder("schedule", gunDosya, true)}
          kaydedilebilir={!!gunOnizleme && !gunOnizleme.saved}
          calisiyor={calisiyor}
        />

        {gunOnizleme && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-900">
                {gunOnizleme.dates.length > 0 && (
                  <>
                    {trTarih(gunOnizleme.dates[0])} –{" "}
                    {trTarih(gunOnizleme.dates[gunOnizleme.dates.length - 1])}
                  </>
                )}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  gunOnizleme.saved
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {gunOnizleme.saved ? "kaydedildi" : "önizleme"}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-3">
              <Kutu deger={gunOnizleme.dates.length} etiket="gün" />
              <Kutu deger={gunOnizleme.exemptRecords} etiket="muafiyet" vurgu="iyi" />
              <Kutu deger={gunOnizleme.peopleCount} etiket="kişi" />
              <Kutu
                deger={gunOnizleme.unresolved.length}
                etiket="çözülemeyen"
                vurgu={gunOnizleme.unresolved.length ? "dikkat" : "iyi"}
              />
            </div>

            {gunOnizleme.unresolved.length > 0 && (
              <div className="border border-yellow-300 rounded-lg p-3 mb-3">
                <p className="font-medium text-gray-900 text-sm mb-1">
                  Çözülemeyen isimler
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Bunlar kimse işaretlenmeden atlandı. Bir kez eşlerseniz sonraki
                  yüklemelerde otomatik uygulanır.
                </p>
                <div className="divide-y">
                  {gunOnizleme.unresolved.map((u) => (
                    <div key={u.token} className="py-2 flex flex-wrap gap-2 items-center">
                      <div className="flex-1 min-w-[160px]">
                        <span className="font-medium text-gray-900 text-sm">{u.token}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {u.count} kez ·{" "}
                          {u.reason === "belirsiz"
                            ? u.candidates.map((c) => c.name).join(" / ")
                            : "listede yok"}
                        </span>
                      </div>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          esle(
                            u.token,
                            e.target.value === "yoksay" ? null : Number(e.target.value)
                          );
                        }}
                        className="border rounded-lg px-2 py-1.5 text-sm text-gray-800 max-w-[210px]"
                      >
                        <option value="" disabled>
                          Kime ait?
                        </option>
                        {u.candidates.length > 0 && (
                          <optgroup label="Adaylar">
                            {u.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Tüm asistanlar">
                          {assistants.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Diğer">
                          <option value="yoksay">Asistan değil — yok say</option>
                        </optgroup>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gunOnizleme.unknownLabels.length > 0 && (
              <div className="text-sm text-gray-600 mb-3">
                <p className="font-medium text-gray-900 mb-1">Tanınmayan etiketler</p>
                <ul className="text-gray-500 space-y-0.5">
                  {gunOnizleme.unknownLabels.map((l) => (
                    <li key={l.label}>
                      {l.label} — {l.count} kez ({l.example})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gunOnizleme.sample.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600">
                  İlk gün dökümü ({trTarih(gunOnizleme.dates[0])})
                </summary>
                <table className="w-full text-sm mt-2">
                  <tbody>
                    {gunOnizleme.sample.map((s, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 text-gray-900">{s.name}</td>
                        <td className="py-1.5 pr-3 text-gray-600">{s.location}</td>
                        <td className="py-1.5 text-gray-400 text-xs">{s.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ---------- Yüklü durum ---------- */}
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Yüklü veriler</h2>

        <p className="text-sm font-medium text-gray-700 mb-1">Rotasyon dönemleri</p>
        {donemler.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">Henüz rotasyon yüklenmedi.</p>
        ) : (
          <ul className="text-sm text-gray-600 mb-4 space-y-0.5">
            {donemler.map((p) => (
              <li key={p.startDate}>
                {trTarih(p.startDate)} – {trTarih(p.endDate)} · {p.count} kişi
                {p.source && <span className="text-gray-400"> · {p.source}</span>}
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm font-medium text-gray-700 mb-1">Günlük çizelge</p>
        {gunler.length === 0 ? (
          <p className="text-sm text-gray-500">Henüz çizelge yüklenmedi.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {gunler.map((g) => (
              <span
                key={g.date}
                title={`${g.count} kişi${g.source ? ` · ${g.source}` : ""}`}
                className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1"
              >
                {trTarih(g.date)} <span className="text-gray-400">({g.count})</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
