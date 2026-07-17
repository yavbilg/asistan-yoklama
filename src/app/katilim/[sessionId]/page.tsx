"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { assistants, WORK_LOCATIONS, isExempt } from "@/lib/assistants";
import { Session, getSessions, saveSession } from "@/lib/store";
import { syncToGoogleSheets } from "@/lib/sheets";

export default function KatilimPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [selectedAssistant, setSelectedAssistant] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showExemptForm, setShowExemptForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");

  useEffect(() => {
    const sessions = getSessions();
    const found = sessions.find((s) => s.id === sessionId);
    if (found) setSession(found);
  }, [sessionId]);

  const refreshSession = () => {
    const sessions = getSessions();
    const found = sessions.find((s) => s.id === sessionId);
    if (found) setSession(found);
  };

  const markPresent = (assistantId: number) => {
    if (!session) return;

    const updated = { ...session };
    const record = updated.attendance.find((a) => a.assistantId === assistantId);
    if (record) {
      record.status = "var";
      record.timestamp = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    saveSession(updated);
    setSession(updated);
    syncToGoogleSheets(updated);
    const name = assistants.find((a) => a.id === assistantId)?.name;
    setMessage({ type: "success", text: `${name} - Yoklama alindi!` });
    setSelectedAssistant(null);
    setSearchQuery("");
    setTimeout(() => setMessage(null), 3000);
  };

  const markExempt = (assistantId: number, location: string) => {
    if (!session) return;

    const updated = { ...session };
    const record = updated.attendance.find((a) => a.assistantId === assistantId);
    if (record) {
      record.status = "muaf";
      record.workLocation = location;
      record.timestamp = new Date().toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    saveSession(updated);
    setSession(updated);
    syncToGoogleSheets(updated);
    const name = assistants.find((a) => a.id === assistantId)?.name;
    setMessage({ type: "success", text: `${name} - Muaf olarak kaydedildi (${location})` });
    setSelectedAssistant(null);
    setShowExemptForm(false);
    setSelectedLocation("");
    setSearchQuery("");
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredAssistants = assistants.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatus = (assistantId: number) => {
    if (!session) return "yok";
    return session.attendance.find((a) => a.assistantId === assistantId)?.status || "yok";
  };

  const getWorkLocation = (assistantId: number) => {
    if (!session) return "";
    return session.attendance.find((a) => a.assistantId === assistantId)?.workLocation || "";
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <p className="text-gray-500 text-lg">Oturum bulunamadi</p>
          <p className="text-gray-400 text-sm mt-2">Bu yoklama oturumu mevcut degil veya sona ermis.</p>
        </div>
      </div>
    );
  }

  if (!session.active) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <p className="text-red-500 text-lg font-medium">Bu yoklama oturumu sona ermis</p>
          <p className="text-gray-400 text-sm mt-2">{session.lessonName} - {session.date}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white rounded-xl p-4 mb-6">
        <h1 className="text-xl font-bold">{session.lessonName}</h1>
        <p className="text-blue-100 text-sm">
          {session.date} | {session.startTime} - {session.endTime}
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
                className={`w-full text-left px-4 py-3 rounded-lg border font-medium ${
                  selectedLocation === location
                    ? "border-yellow-500 bg-yellow-50 text-yellow-800"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {location}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setShowExemptForm(false);
              setSelectedLocation("");
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
