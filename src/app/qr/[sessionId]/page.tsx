"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Session, getSessions } from "@/lib/store";
import Link from "next/link";
import QRCode from "qrcode";

export default function QRPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sessions = getSessions();
    const found = sessions.find((s) => s.id === sessionId);
    if (found) {
      setSession(found);

      const baseUrl = "https://asistan-yoklama.vercel.app";

      const qp = new URLSearchParams({
        s: found.id,
        l: found.lessonName,
        d: found.date,
        st: found.startTime,
        et: found.endTime,
      });
      setQrUrl(`${baseUrl}/katilim?${qp.toString()}`);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!qrUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  }, [qrUrl]);

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
      <p className="text-gray-500 mb-8">
        {session.date} | {session.startTime} - {session.endTime}
      </p>

      <div className="bg-white border-4 border-gray-200 rounded-2xl p-8 mb-8 shadow-lg">
        <canvas ref={canvasRef} />
      </div>

      <p className="text-lg text-gray-700 font-medium mb-2">
        QR kodu telefonunuzla okutun
      </p>
      <p className="text-sm text-gray-400 mb-6 break-all max-w-md text-center">
        {qrUrl}
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
