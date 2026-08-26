"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WORK_LOCATIONS, isExempt } from "@/lib/assistants";
import {
  Assistant,
  Session,
  claimAttendance,
  fetchAssistants,
  fetchSession,
  trTarih,
} from "@/lib/api";

function KatilimIcerik() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");
  const token = searchParams.get("t");

  const [session, setSession] = useState<Session | null>(null);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [secili, setSecili] = useState<number | null>(null);
  const [arama, setArama] = useState("");
  const [muafFormu, setMuafFormu] = useState(false);
  const [gonderilenAd, setGonderilenAd] = useState<string | null>(null);
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let iptal = false;

    (async () => {
      // Aynı cihazdan ikinci kez yoklama verilmesin.
      const kayit = localStorage.getItem(`yoklama_done_${sessionId}`);
      if (kayit && !iptal) setGonderilenAd(kayit);

      try {
        const [s, a] = await Promise.all([fetchSession(sessionId), fetchAssistants()]);
        if (iptal) return;
        setSession(s);
        setAssistants(a);
      } catch (e) {
        if (!iptal) setHata(e instanceof Error ? e.message : "Oturum bulunamadı.");
      }
    })();

    return () => {
      iptal = true;
    };
  }, [sessionId]);

  const gonder = async (assistantId: number, status: "var" | "muaf", location?: string) => {
    if (!sessionId || !token) return;
    setGonderiliyor(true);
    setHata("");
    try {
      await claimAttendance(sessionId, token, assistantId, status, location);
      const ad = assistants.find((a) => a.id === assistantId)?.name ?? "";
      localStorage.setItem(`yoklama_done_${sessionId}`, ad);
      setGonderilenAd(ad);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Gönderilemedi.");
      setSecili(null);
      setMuafFormu(false);
    } finally {
      setGonderiliyor(false);
    }
  };

  if (!sessionId || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <p className="text-gray-500 text-lg">Geçersiz yoklama bağlantısı</p>
          <p className="text-gray-400 text-sm mt-2">Lütfen QR kodu tekrar okutun.</p>
        </div>
      </div>
    );
  }

  if (gonderilenAd) {
    return (
      <div className="max-w-lg mx-auto p-4 min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center w-full">
          <div className="text-5xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">Yoklama Alındı</h1>
          <p className="text-green-700 text-lg font-medium mb-4">{gonderilenAd}</p>
          {session && (
            <div className="bg-white rounded-xl p-4 mt-4">
              <p className="text-gray-700 font-medium">{session.lessonName}</p>
              <p className="text-gray-500 text-sm">
                {trTarih(session.date)} | {session.startTime} - {session.endTime}
              </p>
            </div>
          )}
          <p className="text-gray-400 text-sm mt-6">Bu cihazdan yoklama zaten verildi.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">{hata || "Yükleniyor…"}</p>
      </div>
    );
  }

  const gosterilen = assistants.filter((a) =>
    a.name.toLocaleLowerCase("tr").includes(arama.toLocaleLowerCase("tr"))
  );

  return (
    <div className="max-w-lg mx-auto p-4 min-h-screen bg-gray-50">
      <div className="bg-white rounded-2xl p-5 mb-4 border">
        <h1 className="text-xl font-bold text-gray-900">{session.lessonName}</h1>
        <p className="text-gray-500 text-sm">
          {trTarih(session.date)} | {session.startTime} - {session.endTime}
        </p>
      </div>

      {hata && (
        <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-4 text-sm text-center">
          {hata}
        </div>
      )}

      {muafFormu && secili !== null ? (
        <div className="bg-white rounded-2xl p-5 border">
          <p className="font-medium text-gray-900 mb-1">
            {assistants.find((a) => a.id === secili)?.name}
          </p>
          <p className="text-sm text-gray-500 mb-4">Çalışma yerinizi seçin:</p>
          <div className="grid grid-cols-2 gap-2">
            {WORK_LOCATIONS.filter((l) => isExempt(l)).map((loc) => (
              <button
                key={loc}
                disabled={gonderiliyor}
                onClick={() => gonder(secili, "muaf", loc)}
                className="border rounded-xl px-3 py-3 text-sm hover:bg-gray-50 disabled:opacity-50 text-gray-800"
              >
                {loc}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setMuafFormu(false);
              setSecili(null);
            }}
            className="mt-4 text-sm text-gray-500 underline"
          >
            Geri
          </button>
        </div>
      ) : secili !== null ? (
        <div className="bg-white rounded-2xl p-5 border text-center">
          <p className="font-medium text-gray-900 mb-4">
            {assistants.find((a) => a.id === secili)?.name}
          </p>
          <div className="flex flex-col gap-2">
            <button
              disabled={gonderiliyor}
              onClick={() => gonder(secili, "var")}
              className="bg-green-600 text-white rounded-xl py-3 font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {gonderiliyor ? "Gönderiliyor…" : "Derste Varım"}
            </button>
            <button
              disabled={gonderiliyor}
              onClick={() => setMuafFormu(true)}
              className="border rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Muafım (görevdeyim)
            </button>
            <button onClick={() => setSecili(null)} className="text-sm text-gray-500 underline mt-2">
              Geri
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Adınızı arayın…"
            className="w-full border rounded-xl px-4 py-3 text-gray-900 mb-3"
          />
          <div className="bg-white rounded-2xl border divide-y overflow-hidden">
            {gosterilen.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">Eşleşen isim yok.</p>
            )}
            {gosterilen.map((a) => (
              <button
                key={a.id}
                onClick={() => setSecili(a.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 text-gray-900"
              >
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function KatilimPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <p className="text-gray-500">Yükleniyor…</p>
        </div>
      }
    >
      <KatilimIcerik />
    </Suspense>
  );
}
