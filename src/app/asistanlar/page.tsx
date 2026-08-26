"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Assistant,
  fetchAssistants,
  addAssistant,
  patchAssistant,
  removeAssistant,
} from "@/lib/api";

export default function AsistanlarPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [pasifleriGoster, setPasifleriGoster] = useState(false);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniTarih, setYeniTarih] = useState("");
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null);
  const [duzenAd, setDuzenAd] = useState("");
  const [duzenTarih, setDuzenTarih] = useState("");
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);

  const yenile = useCallback(async () => {
    try {
      setAssistants(await fetchAssistants(true));
      setHata("");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Liste yüklenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(yenile, 0);
    return () => clearTimeout(t);
  }, [yenile]);

  const ekle = async () => {
    if (!yeniAd.trim()) return;
    try {
      await addAssistant(yeniAd.trim(), yeniTarih.trim());
      setYeniAd("");
      setYeniTarih("");
      await yenile();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Eklenemedi.");
    }
  };

  const duzenlemeyiKaydet = async (id: number) => {
    try {
      await patchAssistant(id, { name: duzenAd.trim(), endDate: duzenTarih.trim() });
      setDuzenlenen(null);
      await yenile();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Kaydedilemedi.");
    }
  };

  const durumDegistir = async (a: Assistant) => {
    // Pasife alma silme değil: geçmiş yoklama kayıtları korunur.
    if (a.active && !confirm(`${a.name} pasife alınsın mı? Geçmiş kayıtları korunur.`)) return;
    try {
      if (a.active) await removeAssistant(a.id);
      else await patchAssistant(a.id, { active: true });
      await yenile();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "İşlem başarısız.");
    }
  };

  const gorunen = assistants.filter((a) => pasifleriGoster || a.active);
  const pasifSayi = assistants.filter((a) => !a.active).length;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
        &larr; Ana Sayfa
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-1 mb-6">Asistanlar</h1>

      {hata && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {hata}
        </div>
      )}

      <div className="bg-white border rounded-xl p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Yeni asistan ekle</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">Ad soyad</label>
            <input
              type="text"
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ekle()}
              placeholder="Ayşe Yılmaz"
              className="w-full border rounded-lg px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Başlangıç (GG.AA.YY)</label>
            <input
              type="text"
              value={yeniTarih}
              onChange={(e) => setYeniTarih(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ekle()}
              placeholder="21.11.25"
              className="border rounded-lg px-3 py-2 text-gray-900 w-36"
            />
          </div>
          <button
            onClick={ekle}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Ekle
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Başlangıç tarihi kıdem hesabında kullanılır: 42 ayı dolduran asistan derslerden
          otomatik muaf sayılır.
        </p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">
          Kayıtlı asistanlar ({gorunen.length})
        </h2>
        {pasifSayi > 0 && (
          <label className="text-sm text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={pasifleriGoster}
              onChange={(e) => setPasifleriGoster(e.target.checked)}
            />
            Pasifleri göster ({pasifSayi})
          </label>
        )}
      </div>

      {yukleniyor ? (
        <p className="text-gray-500">Yükleniyor…</p>
      ) : (
        <div className="bg-white border rounded-xl divide-y overflow-hidden">
          {gorunen.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              {duzenlenen === a.id ? (
                <>
                  <input
                    type="text"
                    value={duzenAd}
                    onChange={(e) => setDuzenAd(e.target.value)}
                    className="border rounded-lg px-2 py-1 text-sm flex-1 min-w-[160px] text-gray-900"
                  />
                  <input
                    type="text"
                    value={duzenTarih}
                    onChange={(e) => setDuzenTarih(e.target.value)}
                    className="border rounded-lg px-2 py-1 text-sm w-28 text-gray-900"
                  />
                  <button
                    onClick={() => duzenlemeyiKaydet(a.id)}
                    className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700"
                  >
                    Kaydet
                  </button>
                  <button
                    onClick={() => setDuzenlenen(null)}
                    className="text-sm text-gray-500 underline"
                  >
                    Vazgeç
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-gray-400 w-8">#{a.id}</span>
                  <span
                    className={`flex-1 min-w-[140px] font-medium ${
                      a.active ? "text-gray-900" : "text-gray-400 line-through"
                    }`}
                  >
                    {a.name}
                  </span>
                  <span className="text-sm text-gray-500 w-24">{a.endDate || "-"}</span>
                  <button
                    onClick={() => {
                      setDuzenlenen(a.id);
                      setDuzenAd(a.name);
                      setDuzenTarih(a.endDate);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => durumDegistir(a)}
                    className={`text-sm ${
                      a.active ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"
                    }`}
                  >
                    {a.active ? "Pasife al" : "Aktifleştir"}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
