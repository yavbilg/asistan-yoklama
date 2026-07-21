"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Session, getSessions } from "@/lib/store";
import { generateToken, getSecondsRemaining } from "@/lib/token";
import Link from "next/link";
import QRCode from "qrcode";

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

export default function QRPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [countdown, setCountdown] = useState(20);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sessions = getSessions();
    const found = sessions.find((s) => s.id === sessionId);
    if (found) setSession(found);
  }, [sessionId]);

  const refreshQR = useCallback(() => {
    if (!session) return;
    const token = generateToken(session.id);
    const baseUrl = "https://asistan-yoklama.vercel.app";
    const qp = new URLSearchParams({
      s: session.id,
      l: session.lessonName,
      d: session.date,
      st: session.startTime,
      et: session.endTime,
      t: token,
    });
    setQrUrl(`${baseUrl}/katilim?${qp.toString()}`);
    setCountdown(getSecondsRemaining());
  }, [session]);

  useEffect(() => {
    if (!session) return;
    refreshQR();
    const interval = setInterval(refreshQR, 1000);
    return () => clearInterval(interval);
  }, [session, refreshQR]);

  useEffect(() => {
    if (!qrUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  }, [qrUrl]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getSecondsRemaining());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Oturum bulunamadi...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {session.lessonName}
      </h1>
      <p className="text-gray-500 mb-6">
        {formatDate(session.date)} | {formatDate(session.startTime)} - {formatDate(session.endTime)}
      </p>

      <div className="bg-white border-4 border-gray-200 rounded-2xl p-8 mb-4 shadow-lg relative">
        <canvas ref={canvasRef} />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold text-lg">
          {countdown} sn
        </div>
        <span className="text-gray-500 text-sm">sonra QR kod yenilenecek</span>
      </div>

      <p className="text-lg text-gray-700 font-medium mb-2">
        QR kodu telefonunuzla okutun
      </p>
      <p className="text-xs text-red-500 font-medium mb-6">
        QR kod her 40 saniyede degisir, ekran goruntusu gecersiz olur
      </p>

      <Link
        href="/"
        className="text-blue-600 hover:text-blue-800 font-medium"
      >
        Ana Sayfaya Don
      </Link>
    </div>
  );
}
