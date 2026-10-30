"use client";

import { useFormStatus } from "react-dom";

/**
 * Gönderim sürerken düğmeyi kilitler — iki kez basılıp iki istek gitmesin.
 * JavaScript henüz yüklenmediyse normal bir gönder düğmesi gibi davranır.
 */
export default function GonderButonu({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-green-600 text-white rounded-xl py-4 text-lg font-semibold hover:bg-green-700 disabled:opacity-60"
    >
      {pending ? "Gönderiliyor…" : children}
    </button>
  );
}
