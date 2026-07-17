"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { assistants, WORK_LOCATIONS, CURRENT_WORK_LOCATIONS, isExempt } from "@/lib/assistants";

import { updateAttendanceInCloud } from "@/lib/sheets";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_ysXd0y-IsFSEq-_MtPLzPjZi6Mv7GecY_PXjMdHnZMzqOQLLWSjcUNq2iS_njMg5/exec";

interface AttendanceRecord {
  assistantId: number;
  status: "var" | "yok" | "muaf";
  workLocation?: string;
  timestamp?: string;
}

function buildInitialAttendance(): AttendanceRecord[] {
  return assistants.map((a) => {
    const workLocation = CURRENT_WORK_LOCATIONS[a.id];
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
  });
}

async function sendToSheets(
  lessonName: string,
  date: string,
  startTime: string,
  endTime: string,
  attendance: AttendanceRecord[]
) {
  try {
    const payload = {
      lessonName,
      date,
      startTime,
      endTime,
      attendance: attendance.map((a) => ({
        name: assistants.find((ast) => ast.id === a.assistantId)?.name || "",
        endDate: assistants.find((ast) => ast.id === a.assistantId)?.endDate || "",
        status: a.status === "var" ? "VAR" : a.status === "muaf" ? "MUAF" : "YOK",
        workLocation: a.workLocation || "",
        timestamp: a.timestamp || "",
      })),
    };
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
  } catch {
    console.error("Google Sheets sync failed");
  }
}

function KatilimContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");
  const lessonName = searchParams.get("l");
  const date = searchParams.get("d");
  const startTime = searchParams.get("st");
  const endTime = searchParams.get("et");

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showExemptForm, setShowExemptForm] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const doneKey = `yoklama_done_${sessionId}`;
    const alreadyDone = localStorage.getItem(doneKey);
    if (alreadyDone) {
      setSubmittedName(alreadyDone);
      return;
    }
    const storageKey = `katilim_${sessionId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setAttendance(JSON.parse(saved));
    } else {
      const initial = buildInitialAttendance();
      setAttendance(initial);
      localStorage.setItem(storageKey, JSON.stringify(initial));
    }
  }, [sessionId]);

  const saveAttendance = (updated: AttendanceRecord[]) => {
    setAttendance(updated);
    if (sessionId) {
      localStorage.setItem(`katilim_${sessionId}`, JSON.stringify(updated));
    }
  };

  const markPresent = (assistantId: number) => {
    const updated = [...attendance];
    const record = updated.find((a) => a.assistantId === assistantId);
    if (record) {
      record.status = "var";
      record.timestamp = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    saveAttendance(updated);
    if (lessonName && date && startTime && endTime) {
      sendToSheets(lessonName, date, startTime, endTime, updated);
    }
    const ts = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    if (sessionId) {
      updateAttendanceInCloud(sessionId, assistantId, "var", "", ts);
    }
    const name = assistants.find((a) => a.id === assistantId)?.name || "";
    if (sessionId) {
      localStorage.setItem(`yoklama_done_${sessionId}`, name);
    }
    setSubmittedName(name);
  };

  const markExempt = (assistantId: number, location: string) => {
    const updated = [...attendance];
    const record = updated.find((a) => a.assistantId === assistantId);
    if (record) {
      record.status = "muaf";
      record.workLocation = location;
      record.timestamp = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    saveAttendance(updated);
    if (lessonName && date && startTime && endTime) {
      sendToSheets(lessonName, date, startTime, endTime, updated);
    }
    const ts = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    if (sessionId) {
      updateAttendanceInCloud(sessionId, assistantId, "muaf", location, ts);
    }
    const name = assistants.find((a) => a.id === assistantId)?.name || "";
    if (sessionId) {
      localStorage.setItem(`yoklama_done_${sessionId}`, name);
    }
    setSubmittedName(name);
  };

  if (!sessionId || !lessonName || !date || !startTime || !endTime) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <p className="text-gray-500 text-lg">Gecersiz yoklama linki</p>
          <p className="text-gray-400 text-sm mt-2">Lutfen QR kodu tekrar okutun.</p>
        </div>
      </div>
    );
  }

  if (submittedName) {
    return (
      <div className="max-w-lg mx-auto p-4 min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center w-full">
          <div className="text-5xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">Yoklama Alindi</h1>
          <p className="text-green-700 text-lg font-medium mb-4">{submittedName}</p>
          <div className="bg-white rounded-xl p-4 mt-4">
            <p className="text-gray-700 font-medium">{lessonName}</p>
            <p className="text-gray-500 text-sm">{date} | {startTime} - {endTime}</p>
          </div>
          <p className="text-gray-400 text-sm mt-6">Bu cihazdan yoklama zaten verildi.</p>
        </div>
      </div>
    );
  }

  const filteredAssistants = assistants.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatus = (assistantId: number) => {
    return attendance.find((a) => a.assistantId === assistantId)?.status || "yok";
  };

  const getWorkLocation = (assistantId: number) => {
    return attendance.find((a) => a.assistantId === assistantId)?.workLocation || "";
  };

  return (
    <div className="max-w-lg mx-auto p-4 min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white rounded-xl p-4 mb-6">
        <h1 className="text-xl font-bold">{lessonName}</h1>
        <p className="text-blue-100 text-sm">
          {date} | {startTime} - {endTime}
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl p-4 mb-4 text-center font-medium ${
            message.type === "success"
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {selectedAssistant !== null && !showExemptForm ? (
        <div className="bg-white rounded-xl border p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {assistants.find((a) => a.id === selectedAssistant)?.name}
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => markPresent(selectedAssistant)}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium text-lg hover:bg-green-700"
            >
              VAR - Derse Katildim
            </button>
            <button
              onClick={() => setShowExemptForm(true)}
              className="w-full bg-yellow-500 text-white py-3 rounded-lg font-medium text-lg hover:bg-yellow-600"
            >
              MUAF - Baska Gorevdeyim
            </button>
            <button
              onClick={() => {
                setSelectedAssistant(null);
                setShowExemptForm(false);
              }}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300"
            >
              Geri Don
            </button>
          </div>
        </div>
      ) : showExemptForm && selectedAssistant !== null ? (
        <div className="bg-white rounded-xl border p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {assistants.find((a) => a.id === selectedAssistant)?.name}
          </h2>
          <p className="text-gray-500 text-sm mb-4">Calisma yerinizi secin:</p>
          <div className="space-y-2">
            {WORK_LOCATIONS.filter((loc) => isExempt(loc)).map((location) => (
              <button
                key={location}
                onClick={() => markExempt(selectedAssistant, location)}
                className="w-full text-left px-4 py-3 rounded-lg border font-medium border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {location}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setShowExemptForm(false);
            }}
            className="w-full mt-4 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300"
          >
            Geri Don
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Isim ara..."
              className="w-full border rounded-xl px-4 py-3 text-gray-900 text-lg"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            {filteredAssistants.map((assistant) => {
              const status = getStatus(assistant.id);
              const workLoc = getWorkLocation(assistant.id);
              return (
                <button
                  key={assistant.id}
                  onClick={() => {
                    if (status === "var") return;
                    setSelectedAssistant(assistant.id);
                  }}
                  disabled={status === "var"}
                  className={`w-full text-left px-4 py-3 rounded-xl border font-medium transition ${
                    status === "var"
                      ? "bg-green-50 border-green-200 text-green-800"
                      : status === "muaf"
                      ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                      : "bg-white border-gray-200 text-gray-900 hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span>{assistant.name}</span>
                      {status === "muaf" && workLoc && (
                        <span className="block text-xs text-yellow-600 mt-0.5">{workLoc}</span>
                      )}
                    </div>
                    <span
                      className={`text-sm font-bold px-2 py-1 rounded ${
                        status === "var"
                          ? "bg-green-200 text-green-800"
                          : status === "muaf"
                          ? "bg-yellow-200 text-yellow-800"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {status === "var"
                        ? "VAR"
                        : status === "muaf"
                        ? "MUAF"
                        : "YOK"}
                    </span>
                  </div>
                </button>
              );
            })}
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
          <p className="text-gray-500">Yukleniyor...</p>
        </div>
      }
    >
      <KatilimContent />
    </Suspense>
  );
}
