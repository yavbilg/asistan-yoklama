"use client";

import { useState } from "react";

interface Kisi {
  id: number;
  name: string;
  kayitli: boolean;
}

/**
 * İsim listesi. Sunucuda tam liste olarak çizilir, yani JavaScript gelmeden
 * görünür ve tıklanabilir; arama kutusu JavaScript yüklenince çalışır.
 * Bir telefona zaten kayıtlı isimler seçilemez.
 */
export default function IsimListesi({
  kisiler,
  temelAdres,
}: {
  kisiler: Kisi[];
  temelAdres: string;
}) {
  const [arama, setArama] = useState("");
  const q = arama.trim().toLocaleLowerCase("tr");
  const gorunen = q ? kisiler.filter((k) => k.name.toLocaleLowerCase("tr").includes(q)) : kisiler;

  return (
    <>
      <input
        type="search"
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        placeholder="Adınızı arayın…"
        className="w-full border rounded-xl px-4 py-3 text-gray-900 mb-3"
      />
      <div className="bg-white rounded-2xl border divide-y overflow-hidden">
        {gorunen.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">Eşleşen isim yok.</p>
        )}
        {gorunen.map((k) =>
          k.kayitli ? (
            <div key={k.id} className="px-4 py-3 text-gray-400 flex justify-between gap-2">
              <span>{k.name}</span>
              <span className="text-xs self-center">başka telefona kayıtlı</span>
            </div>
          ) : (
            <a
              key={k.id}
              href={`${temelAdres}&secim=${k.id}`}
              className="block px-4 py-3 hover:bg-gray-50 text-gray-900"
            >
              {k.name}
            </a>
          )
        )}
      </div>
    </>
  );
}
