"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { assistants, WORK_LOCATIONS, isExempt } from "@/lib/assistants";
import { Session, getSessions, saveSession } from "@/lib/store";
import { syncToGoogleSheets, saveSessionToCloud, loadSessionFromCloud } from "@/lib/sheets";
import Link from "next/link";

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

const ADMIN_PASSWORD = "SakaryaPsikiyatri";

export default function YoklamaListePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<"all" | "var" | "yok" | "muaf">("all");
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const handleUnlock = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setUnlocked(true);
      setPasswordError(false);
      setPasswordInput("");
    } else {
      setPasswordError(true);
    }
  };

  useEffect(() => {
    refreshSession();
    refreshFromCloud();
    const interval = setInterval(refreshSession, 3000);
    const cloudInterval = setInterval(refreshFromCloud, 5000);
    return () => {
      clearInterval(interval);
      clearInterval(cloudInterval);
    };
  }, [sessionId]);

  const refreshSession = () => {
    const sessions = getSessions();
    const found = sessions.find((s) => s.id === sessionId);
    if (found) setSession(found);
  };

  const refreshFromCloud = async () => {
    const cloudSession = await loadSessionFromCloud(sessionId);
    if (!cloudSession) return;
    const localSessions = getSessions();
    const local = localSessions.find((s) => s.id === sessionId);
    if (!local) return;
    let changed = false;
    for (const ca of cloudSession.attendance) {
      const la = local.attendance.find((a) => a.assistantId === ca.assistantId);
      if (la && la.status === "yok" && ca.status !== "yok") {
        la.status = ca.status as "var" | "yok" | "muaf";
        la.workLocation = ca.workLocation;
        la.timestamp = ca.timestamp;
        changed = true;
      }
    }
    if (changed) {
      saveSession(local);
      setSession({ ...local });
    }
  };

  const toggleStatus = (assistantId: number) => {
    if (!session) return;
    const updated = { ...session };
    const record = updated.attendance.find((a) => a.assistantId === assistantId);
    if (!record) return;

    if (record.status === "yok") {
      record.status = "var";
      record.timestamp = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (record.status === "var") {
      record.status = "yok";
      record.timestamp = undefined;
      record.workLocation = undefined;
    } else {
      record.status = "yok";
      record.timestamp = undefined;
      record.workLocation = undefined;
    }
    saveSession(updated);
    setSession(updated);
    syncToGoogleSheets(updated);
    saveSessionToCloud(updated);
  };

  const setExempt = (assistantId: number, location: string) => {
    if (!session) return;
    const updated = { ...session };
    const record = updated.attendance.find((a) => a.assistantId === assistantId);
    if (!record) return;
    record.status = "muaf";
    record.workLocation = location;
    record.timestamp = new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    saveSession(updated);
    setSession(updated);
    syncToGoogleSheets(updated);
    saveSessionToCloud(updated);
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Yukleniyor...</p>
      </div>
    );
  }

  const stats = {
    total: session.attendance.length,
    present: session.attendance.filter((a) => a.status === "var").length,
    exempt: session.attendance.filter((a) => a.status === "muaf").length,
    absent: session.attendance.filter(
      (a) => a.status === "yok"
    ).length,
  };

  const filteredAttendance =
    filter === "all"
      ? session.attendance
      : session.attendance.filter((a) => a.status === filter);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Ana Sayfa
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {session.lessonName}
          </h1>
          <p className="text-gray-500">
            {formatDate(session.date)} | {formatDate(session.startTime)} - {formatDate(session.endTime)}
            {session.active && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Aktif
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg p-3 text-center border ${
            filter === "all" ? "border-blue-500 bg-blue-50" : "bg-white"
          }`}
        >
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Toplam</div>
        </button>
        <button
          onClick={() => setFilter("var")}
          className={`rounded-lg p-3 text-center border ${
            filter === "var" ? "border-green-500 bg-green-50" : "bg-white"
          }`}
        >
          <div className="text-2xl font-bold text-green-600">
            {stats.present}
          </div>
          <div className="text-xs text-gray-500">Var</div>
        </button>
        <button
          onClick={() => setFilter("yok")}
          className={`rounded-lg p-3 text-center border ${
            filter === "yok" ? "border-red-500 bg-red-50" : "bg-white"
          }`}
        >
          <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          <div className="text-xs text-gray-500">Yok</div>
        </button>
        <button
          onClick={() => setFilter("muaf")}
          className={`rounded-lg p-3 text-center border ${
            filter === "muaf" ? "border-yellow-500 bg-yellow-50" : "bg-white"
          }`}
        >
          <div className="text-2xl font-bold text-yellow-600">
            {stats.exempt}
          </div>
          <div className="text-xs text-gray-500">Muaf</div>
        </button>
      </div>

      {session.active && !unlocked && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800 font-medium mb-3">
            Yoklama islemleri icin sifre gereklidir
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
              placeholder="Sifre giriniz"
              className={`border rounded-lg px-3 py-2 text-sm flex-1 text-gray-900 ${
                passwordError ? "border-red-400 bg-red-50" : ""
              }`}
            />
            <button
              onClick={handleUnlock}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 text-sm font-medium"
            >
              Kilidi Ac
            </button>
          </div>
          {passwordError && (
            <p className="text-xs text-red-600 mt-1">Yanlis sifre</p>
          )}
        </div>
      )}

      {session.active && unlocked && (
        <div className="mb-4 flex justify-end">
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
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                #
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                Ad Soyad
              </th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">
                Durum
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 hidden sm:table-cell">
                Calisma Yeri
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 hidden sm:table-cell">
                Saat
              </th>
              {session.active && unlocked && (
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">
                  Islem
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredAttendance.map((record, index) => {
              const assistant = assistants.find(
                (a) => a.id === record.assistantId
              );
              if (!assistant) return null;
              return (
                <tr key={record.assistantId} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {assistant.name}
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
                    {record.timestamp || "-"}
                  </td>
                  {session.active && unlocked && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => toggleStatus(record.assistantId)}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                        >
                          {record.status === "var" ? "Yok Yap" : "Var Yap"}
                        </button>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setExempt(record.assistantId, e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="text-xs border rounded px-1 py-1 text-gray-600"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Muaf
                          </option>
                          {WORK_LOCATIONS.filter((l) => isExempt(l)).map(
                            (loc) => (
                              <option key={loc} value={loc}>
                                {loc}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
