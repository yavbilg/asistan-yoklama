"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { assistants, STATIC_EXEMPT, parseScheduleAssignments, isExempt, getSeniorAssistantIds } from "@/lib/assistants";
import {
  Session,
  getSessions,
  saveSession,
  getActiveSession,
  deactivateAllSessions,
  generateSessionId,
} from "@/lib/store";
import { getTodaysLessons, getDayName, type ScheduledLesson } from "@/lib/schedule";
import { saveSessionToCloud, loadSessionsFromCloud, loadDailySchedule } from "@/lib/sheets";

function formatDate(val: string): string {
  if (!val) return val;
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val);
    if (d.getFullYear() < 1900) {
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }
  return val;
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [lessonName, setLessonName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [showNewSession, setShowNewSession] = useState(false);
  const [todaysLessons, setTodaysLessons] = useState<ScheduledLesson[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  useEffect(() => {
    refreshData();
    setTodaysLessons(getTodaysLessons());
    loadFromCloud();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadFromCloud = async () => {
    try {
      const cloudSessions = await loadSessionsFromCloud();
      if (cloudSessions.length > 0) {
        const localSessions = getSessions();
        const localIds = new Set(localSessions.map((s) => s.id));
        let merged = [...localSessions];
        for (const cs of cloudSessions) {
          if (!localIds.has(cs.id)) {
            merged.push(cs);
          }
        }
        for (const s of merged) {
          saveSession(s);
        }
        refreshData();
      }
    } catch {
      // Cloud unavailable, continue with local data
    }
    setCloudLoaded(true);
  };

  const refreshData = () => {
    setSessions(getSessions());
    setActiveSession(getActiveSession());
  };

  const createSessionWith = async (name: string, start: string, end: string) => {
    if (!name.trim()) return;

    deactivateAllSessions();

    const dailyCells = await loadDailySchedule();
    const dynamicExempt = parseScheduleAssignments(dailyCells);
    const seniorIds = getSeniorAssistantIds();
    const seniorExempt: Record<number, string> = {};
    for (const id of seniorIds) {
      seniorExempt[id] = "Kıdemli";
    }
    const allExempt = { ...seniorExempt, ...STATIC_EXEMPT, ...dynamicExempt };

    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
    const newSession: Session = {
      id: generateSessionId(),
      lessonName: name.trim(),
      date: today,
      startTime: start,
      endTime: end,
      createdAt: new Date().toISOString(),
      active: true,
      attendance: assistants.map((a) => {
        const workLocation = allExempt[a.id];
        if (workLocation && isExempt(workLocation)) {
          return {
            assistantId: a.id,
            status: "muaf" as const,
            workLocation,
            timestamp: new Date().toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        }
        return { assistantId: a.id, status: "yok" as const };
      }),
    };

    saveSession(newSession);
    saveSessionToCloud(newSession);
    setShowNewSession(false);
    setLessonName("");
    refreshData();
  };

  const createSession = () => createSessionWith(lessonName, startTime, endTime);

  const startScheduledLesson = (lesson: ScheduledLesson) => {
    createSessionWith(lesson.lessonName, lesson.startTime, lesson.endTime);
  };

  const isLessonAlreadyStarted = (lesson: ScheduledLesson) => {
    const n = new Date();
    const today = `${String(n.getDate()).padStart(2, "0")}.${String(n.getMonth() + 1).padStart(2, "0")}.${n.getFullYear()}`;
    return sessions.some(
      (s) =>
        s.date === today &&
        s.lessonName === lesson.lessonName &&
        s.startTime === lesson.startTime
    );
  };

  const endSession = () => {
    if (!activeSession) return;
    const updated = { ...activeSession, active: false };
    saveSession(updated);
    saveSessionToCloud(updated);
    refreshData();
  };

  const getStats = (session: Session) => {
    const total = session.attendance.length;
    const present = session.attendance.filter((a) => a.status === "var").length;
    const exempt = session.attendance.filter((a) => a.status === "muaf").length;
    const absent = total - present - exempt;
    return { total, present, exempt, absent };
  };

  const downloadCSV = (session: Session) => {
    const nameMap = new Map(assistants.map((a) => [a.id, a.name]));
    const headers = ["Ad Soyad", "Durum", "Calisma Yeri", "Saat"];
    const rows = session.attendance.map((a) => [
      nameMap.get(a.assistantId) || "Bilinmiyor",
      a.status === "var" ? "VAR" : a.status === "muaf" ? "MUAF" : "YOK",
      a.workLocation || "-",
      a.timestamp || "-",
    ]);

    const bom = "﻿";
    const csv = bom + [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `yoklama_${session.lessonName}_${session.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const todayName = getDayName(new Date().getDay());

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Asistan Yoklama Sistemi
        </h1>
        <p className="text-gray-500 mt-1">
          Sakarya Psikiyatri Ana Bilim Dali
        </p>
      </header>

      {activeSession && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-green-700 font-semibold text-lg">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                Aktif Oturum
              </span>
              <h2 className="text-xl font-bold mt-1">
                {activeSession.lessonName}
              </h2>
              <p className="text-gray-600">
                {formatDate(activeSession.date)} | {formatDate(activeSession.startTime)} -{" "}
                {formatDate(activeSession.endTime)}
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

          {(() => {
            const stats = getStats(activeSession);
            return (
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.total}
                  </div>
                  <div className="text-xs text-gray-500">Toplam</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.present}
                  </div>
                  <div className="text-xs text-gray-500">Var</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {stats.absent}
                  </div>
                  <div className="text-xs text-gray-500">Yok</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {stats.exempt}
                  </div>
                  <div className="text-xs text-gray-500">Muaf</div>
                </div>
              </div>
            );
          })()}

          <button
            onClick={endSession}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Oturumu Bitir
          </button>
        </div>
      )}

      {todaysLessons.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Bugunun Dersleri ({todayName})
          </h2>
          <div className="space-y-2">
            {todaysLessons.map((lesson, i) => {
              const alreadyStarted = isLessonAlreadyStarted(lesson);
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between border rounded-xl p-4 ${
                    alreadyStarted ? "bg-gray-50 border-gray-200" : "bg-white border-blue-200"
                  }`}
                >
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {lesson.lessonName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {lesson.startTime} - {lesson.endTime}
                    </p>
                  </div>
                  {alreadyStarted ? (
                    <span className="text-xs text-gray-400 font-medium px-3 py-1.5 bg-gray-100 rounded-lg">
                      Baslatildi
                    </span>
                  ) : (
                    <button
                      onClick={() => startScheduledLesson(lesson)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Yoklama Baslat
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
            <h3 className="font-semibold text-lg mb-4">
              Yeni Yoklama Oturumu
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ders Adi
                </label>
                <input
                  type="text"
                  value={lessonName}
                  onChange={(e) => setLessonName(e.target.value)}
                  placeholder="ornegin: Psikiyatri Semineri"
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Baslangic Saati
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
                    Bitis Saati
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
                  onClick={createSession}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
                >
                  Olustur
                </button>
                <button
                  onClick={() => setShowNewSession(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Iptal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Gecmis Oturumlar
        </h2>
        {sessions.length === 0 ? (
          <p className="text-gray-500">Henuz oturum olusturulmadi.</p>
        ) : (
          <div className="space-y-3">
            {[...sessions]
              .filter((s) => {
                const created = new Date(s.createdAt).getTime();
                const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
                return created >= fourDaysAgo;
              })
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )
              .map((session) => {
                const stats = getStats(session);
                return (
                  <div
                    key={session.id}
                    className="bg-white border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {session.lessonName}
                        {session.active && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Aktif
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatDate(session.date)} | {formatDate(session.startTime)}-{formatDate(session.endTime)} |
                        Var: {stats.present} Yok: {stats.absent} Muaf:{" "}
                        {stats.exempt}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/yoklama/${session.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Detay
                      </Link>
                      <button
                        onClick={() => downloadCSV(session)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        CSV
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
