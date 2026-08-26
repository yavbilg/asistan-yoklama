"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Session, fetchSession, fetchToken, trTarih } from "@/lib/api";

export default function QRPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [hata, setHata] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const s = await fetchSession(sessionId);
        if (!iptal) setSession(s);
      } catch (e) {
        if (!iptal) setHata(e instanceof Error ? e.message : "Oturum bulunamadı.");
      }
    })();
    // Sayfa kapanırsa geç gelen yanıt state'e yazılmasın.
    return () => {
      iptal = true;
    };
  }, [sessionId]);

  /** Token sunucudan alınır; imzalama anahtarı tarayıcıya inmez. */
  const qrYenile = useCallback(async () => {
    try {
      const { token, secondsRemaining } = await fetchToken(sessionId);
      // Sabit adres yerine bulunduğumuz kök: yerelde de, yayında da çalışır.
      const qp = new URLSearchParams({ s: sessionId, t: token });
      setQrUrl(`${window.location.origin}/katilim?${qp.toString()}`);
      setCountdown(secondsRemaining);
      setHata("");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "QR kod alınamadı.");
    }
  }, [sessionId]);

  // Oturum gelince ilk token alınır, sonra saniye başı geri sayım işler ve
  // sayaç bitince yeni token çekilir.
  useEffect(() => {
    if (!session) return;

    const ilk = setTimeout(qrYenile, 0);
    const sayac = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          qrYenile();
          return 40;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(ilk);
      clearInterval(sayac);
    };
  }, [session, qrYenile]);

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
        <p className="text-gray-500">{hata || "Yükleniyor…"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{session.lessonName}</h1>
      <p className="text-gray-500 mb-6">
        {trTarih(session.date)} | {session.startTime} - {session.endTime}
      </p>

      {hata && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {hata}
        </div>
      )}

      <div className="bg-white border-4 border-gray-200 rounded-2xl p-8 mb-4 shadow-lg">
        <canvas ref={canvasRef} />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold text-lg">
          {countdown} sn
        </div>
        <span className="text-gray-500 text-sm">sonra QR kod yenilenecek</span>
      </div>

      <p className="text-lg text-gray-700 font-medium mb-2">QR kodu telefonunuzla okutun</p>
      <p className="text-xs text-red-500 font-medium mb-6">
        QR kod her 40 saniyede değişir, ekran görüntüsü geçersiz olur
      </p>

      <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
