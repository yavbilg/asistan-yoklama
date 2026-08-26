"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Session,
  SessionSummary,
  ScheduleInfo,
  fetchSessions,
  fetchActiveSession,
  startSession,
  finishSession,
  trTarih,
  bugun,
} from "@/lib/api";
import { getTodaysLessons, getDayName, type ScheduledLesson } from "@/lib/schedule";

export default function AdminPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [lessonName, setLessonName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [showNewSession, setShowNewSession] = useState(false);
  const [todaysLessons, setTodaysLessons] = useState<ScheduledLesson[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [raporBas, setRaporBas] = useState("");
  const [raporBit, setRaporBit] = useState("");
  const [cizelge, setCizelge] = useState<ScheduleInfo | null>(null);
  const [aciliyor, setAciliyor] = useState(false);

  const veriYenile = useCallback(async () => {
    try {
      const [liste, aktif] = await Promise.all([fetchSessions(), fetchActiveSession()]);
      setSessions(liste);
      setActiveSession(aktif);
      setHata("");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Veriler yüklenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    // Bugünün dersleri istemci saatine bağlı; sunucu render'ında hesaplanırsa
    // hidrasyon uyuşmazlığı olur, o yüzden bağlandıktan sonra ayarlanıyor.
    const ilk = setTimeout(() => {
      setTodaysLessons(getTodaysLessons());
      veriYenile();
    }, 0);
    // Yoklama başka bir cihazdan işaretlenirken sayaçlar güncel kalsın.
    const t = setInterval(veriYenile, 10000);
    return () => {
      clearTimeout(ilk);
      clearInterval(t);
    };
  }, [veriYenile]);

  const oturumAc = async (name: string, start: string, end: string) => {
    if (!name.trim() || aciliyor) return;
    setAciliyor(true);
    try {
      const { schedule } = await startSession({
        lessonName: name.trim(),
        date: bugun(),
        startTime: start,
        endTime: end,
      });
      setShowNewSession(false);
      setLessonName("");
      setCizelge(schedule ?? null);
      await veriYenile();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Oturum açılamadı.");
    } finally {
      setAciliyor(false);
    }
  };

  const oturumBitir = async () => {
    if (!activeSession) return;
    if (!confirm(`"${activeSession.lessonName}" oturumu kapatılsın mı?`)) return;
    try {
      await finishSession(activeSession.id);
      await veriYenile();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Oturum kapatılamadı.");
    }
  };

  const dersBaslatildiMi = (lesson: ScheduledLesson) =>
    sessions.some(
      (s) =>
        s.date === bugun() &&
        s.lessonName === lesson.lessonName &&
        s.startTime === lesson.startTime
    );

  const raporIndir = () => {
    const p = new URLSearchParams();
    if (raporBas) p.set("from", raporBas);
    if (raporBit) p.set("to", raporBit);
    window.location.href = `/api/export${p.toString() ? `?${p}` : ""}`;
  };

  const aktifSayim = activeSession
    ? activeSession.attendance.reduce(
        (acc, a) => ({ ...acc, [a.status]: acc[a.status] + 1 }),
        { var: 0, yok: 0, muaf: 0 } as Record<string, number>
      )
    : null;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistan Yoklama Sistemi</h1>
          <p className="text-gray-500 mt-1">Sakarya Psikiyatri Ana Bilim Dalı</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/cizelge"
            className="text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-2 whitespace-nowrap"
          >
            Çizelge
          </Link>
          <Link
            href="/asistanlar"
            className="text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-2 whitespace-nowrap"
          >
            Asistanlar
          </Link>
        </div>
      </header>

      {hata && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {hata}
        </div>
      )}

      {cizelge && (
        <div
          className={`mb-6 rounded-xl p-4 text-sm border ${
            cizelge.warnings.length > 0
              ? "bg-yellow-50 border-yellow-300 text-yellow-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">
              Görev çizelgesi: {cizelge.matched} kişi otomatik muaf işaretlendi
              {cizelge.sheetName && ` (${cizelge.sheetName})`}
            </p>
            <button
              onClick={() => setCizelge(null)}
              className="text-xs underline shrink-0"
            >
              kapat
            </button>
          </div>
          {cizelge.warnings.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-0.5">
              {cizelge.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {yukleniyor ? (
        <p className="text-gray-500">Yükleniyor…</p>
      ) : (
        <>
          {activeSession && aktifSayim && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 text-green-700 font-semibold text-lg">
                    <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    Aktif Oturum
                  </span>
                  <h2 className="text-xl font-bold mt-1">{activeSession.lessonName}</h2>
                  <p className="text-gray-600">
                    {trTarih(activeSession.date)} | {activeSession.startTime} -{" "}
                    {activeSession.endTime}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/qr/${activeSession.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    QR Kodu
                  </Link>
                  <Link
                    href={`/yoklama/${activeSession.id}`}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium"
                  >
                    Yoklama Listesi
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {activeSession.attendance.length}
                  </div>
                  <div className="text-xs text-gray-500">Toplam</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{aktifSayim.var}</div>
                  <div className="text-xs text-gray-500">Var</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{aktifSayim.yok}</div>
                  <div className="text-xs text-gray-500">Yok</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{aktifSayim.muaf}</div>
                  <div className="text-xs text-gray-500">Muaf</div>
                </div>
              </div>

              <button
                onClick={oturumBitir}
                className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Oturumu Bitir
              </button>
            </div>
          )}

          {todaysLessons.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Bugünün Dersleri ({getDayName(new Date().getDay())})
              </h2>
              <div className="space-y-2">
                {todaysLessons.map((lesson, i) => {
                  const baslatildi = dersBaslatildiMi(lesson);
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between border rounded-xl p-4 ${
                        baslatildi ? "bg-gray-50 border-gray-200" : "bg-white border-blue-200"
                      }`}
                    >
                      <div>
                        <h3 className="font-medium text-gray-900">{lesson.lessonName}</h3>
                        <p className="text-sm text-gray-500">
                          {lesson.startTime} - {lesson.endTime}
                        </p>
                      </div>
                      {baslatildi ? (
                        <span className="text-xs text-gray-400 font-medium px-3 py-1.5 bg-gray-100 rounded-lg">
                          Başlatıldı
                        </span>
                      ) : (
                        <button
                          disabled={aciliyor}
                          onClick={() =>
                            oturumAc(lesson.lessonName, lesson.startTime, lesson.endTime)
                          }
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                        >
                          {aciliyor ? "Çizelge okunuyor…" : "Yoklama Başlat"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6">
            {!showNewSession ? (
              <button
                onClick={() => setShowNewSession(true)}
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-medium w-full sm:w-auto border border-gray-300"
              >
                + Yeni Yoklama Oturumu (Manuel)
              </button>
            ) : (
              <div className="bg-white border rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-4">Yeni Yoklama Oturumu</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ders Adı
                    </label>
                    <input
                      type="text"
                      value={lessonName}
                      onChange={(e) => setLessonName(e.target.value)}
                      placeholder="örneğin: Psikiyatri Semineri"
                      className="w-full border rounded-lg px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Başlangıç Saati
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bitiş Saati
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={aciliyor}
                      onClick={() => oturumAc(lessonName, startTime, endTime)}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                    >
                      {aciliyor ? "Çizelge okunuyor…" : "Oluştur"}
                    </button>
                    <button
                      onClick={() => setShowNewSession(false)}
                      className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Dönem Raporu (Excel)</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Başlangıç</label>
                <input
                  type="date"
                  value={raporBas}
                  onChange={(e) => setRaporBas(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bitiş</label>
                <input
                  type="date"
                  value={raporBit}
                  onChange={(e) => setRaporBit(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-gray-900 text-sm"
                />
              </div>
              <button
                onClick={raporIndir}
                className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm font-medium"
              >
                İndir
              </button>
              <span className="text-xs text-gray-500">
                Boş bırakılırsa tüm oturumlar indirilir.
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Geçmiş Oturumlar</h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500">Henüz oturum oluşturulmadı.</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-white border rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900">
                        {session.lessonName}
                        {session.active && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Aktif
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {trTarih(session.date)} | {session.startTime}-{session.endTime} | Var:{" "}
                        {session.counts.var} Yok: {session.counts.yok} Muaf:{" "}
                        {session.counts.muaf}
                      </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <Link
                        href={`/yoklama/${session.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Detay
                      </Link>
                      <a
                        href={`/api/sessions/${session.id}/export`}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Excel
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
