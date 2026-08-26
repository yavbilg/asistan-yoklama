import ExcelJS from "exceljs";
import type { Assistant } from "./db";
import { isExempt, type WorkLocation } from "./assistants";

/**
 * Aylık görev çizelgesi Excel dosyasını okur.
 *
 * Dosya düzeni: haftalık bloklar. Bir satırda gerçek tarih hücreleri
 * (Pazartesi…Cuma), altındaki satırlarda "ETİKET: İSİM, İSİM" biçiminde
 * görevler. Sütunda aşağı inilir, bir sonraki tarih hücresinde durulur.
 *
 * Sekme adına bakılmaz — tarih hücresinin kendisi günü söyler. Eski Apps
 * Script sürümü ayı sekme adından bulmaya çalışıyordu ve hiç tutturamıyordu.
 */

export interface ParsedDuty {
  date: string; // YYYY-MM-DD
  assistantId: number;
  assistantName: string;
  workLocation: WorkLocation;
  label: string;
}

/** Çözülemeyen bir isim — kullanıcı bir kez eşleyip kaydeder. */
export interface Unresolved {
  token: string;
  reason: "belirsiz" | "taninmiyor";
  candidates: { id: number; name: string }[];
  count: number;
  examples: string[];
}

export interface ParseResult {
  duties: ParsedDuty[];
  unresolved: Unresolved[];
  unknownLabels: { label: string; count: number; example: string }[];
  dates: string[];
  sheetNames: string[];
}

function norm(s: unknown): string {
  return String(s ?? "")
    .replace(/i/g, "İ")
    .replace(/ı/g, "I")
    .toLocaleUpperCase("tr")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/[İI]/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ü/g, "U")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Etiket → çalışma yeri. Sıra önemli: ilk eşleşen kural kazanır.
 * Tanınmayan etiketler yok sayılmaz, sonuçta ayrıca raporlanır.
 */
const LABEL_RULES: { test: RegExp; yer: WorkLocation }[] = [
  { test: /^ADLI/, yer: "Asker/Adli" },
  { test: /^IZIN/, yer: "İzin/Rapor" },
  { test: /^N\.?\s*E/, yer: "Nöbet Ertesi" },
  { test: /AMATEM/, yer: "Pol-AMATEM" },
  { test: /TRSM/, yer: "TRSM" },
  { test: /KONS|^KLP/, yer: "Konsültasyon" },
  { test: /CMY/, yer: "Çoc. Psikiyatrisi" },
  { test: /POL/, yer: "Poliklinik" },
  // "ATİLA H", "ALİ H", "ESRA H", "YAVUZ H", "YAVUZ SELİM H" — hoca poliklinikleri
  { test: /\bH$|\bH\b/, yer: "Poliklinik" },
];

function labelToLocation(label: string): WorkLocation | null {
  const n = norm(label);
  for (const kural of LABEL_RULES) if (kural.test.test(n)) return kural.yer;
  return null;
}

/** Ad parçalarından arama dizini: her parça (ad, ikinci ad, soyad) anahtar. */
function buildIndex(assistants: Assistant[]): Map<string, Assistant[]> {
  const dizin = new Map<string, Assistant[]>();
  for (const a of assistants) {
    for (const parca of norm(a.name).split(" ")) {
      if (parca.length < 2) continue;
      const liste = dizin.get(parca);
      if (liste) liste.push(a);
      else dizin.set(parca, [a]);
    }
  }
  return dizin;
}

/**
 * Adayları baş harfle daraltır. Çizelgede "MERVE E" (Eroğlu) ve "BETÜL G"
 * (Betül Gizem) gibi yazımlar tam da bu ayrımı yapmak için kullanılıyor.
 */
function narrowByInitial(adaylar: Assistant[], initial: string): Assistant[] {
  const h = norm(initial);
  return adaylar.filter((a) =>
    norm(a.name)
      .split(" ")
      .some((p) => p.startsWith(h))
  );
}

/**
 * Ayırıcısı unutulmuş bitişik yazımları böler: "SUEDAKUBRA" → "SUEDA" + "KUBRA".
 * Yalnızca tek bir geçerli bölünme varsa uygular; birden çok ihtimal varsa
 * tahmin etmez, bölünmemiş hâlini döndürür.
 */
function splitJoined(
  anahtar: string,
  dizin: Map<string, Assistant[]>
): string[] | null {
  if (anahtar.length < 6 || dizin.has(anahtar)) return null;

  const ikisiDeBilinen: string[][] = [];
  const yalnizOnEk: string[][] = [];

  for (let i = 3; i <= anahtar.length - 3; i++) {
    const on = anahtar.slice(0, i);
    const arka = anahtar.slice(i);
    const onVar = dizin.has(on);
    const arkaVar = dizin.has(arka);

    if (onVar && arkaVar) ikisiDeBilinen.push([on, arka]);
    else if (onVar) yalnizOnEk.push([on, arka]);
    else if (arkaVar) yalnizOnEk.push([on, arka]);
  }

  if (ikisiDeBilinen.length === 1) return ikisiDeBilinen[0];
  if (ikisiDeBilinen.length > 1) return null; // belirsiz, tahmin etme
  if (yalnizOnEk.length === 1) return yalnizOnEk[0];
  return null;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((t) => t.text).join("");
  }
  if (v instanceof Date) return "";
  return String(v);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function parseScheduleWorkbook(
  buffer: ArrayBuffer,
  assistants: Assistant[],
  aliases: Map<string, number | null> = new Map()
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const dizin = buildIndex(assistants);
  const duties: ParsedDuty[] = [];
  const dates = new Set<string>();
  const sheetNames: string[] = [];

  const cozulemeyen = new Map<string, Unresolved>();
  const bilinmeyenEtiket = new Map<string, { count: number; example: string }>();

  const notResolved = (
    token: string,
    reason: Unresolved["reason"],
    candidates: Assistant[],
    ornek: string
  ) => {
    const anahtar = norm(token);
    const mevcut = cozulemeyen.get(anahtar);
    if (mevcut) {
      mevcut.count++;
      if (mevcut.examples.length < 3 && !mevcut.examples.includes(ornek)) {
        mevcut.examples.push(ornek);
      }
      return;
    }
    cozulemeyen.set(anahtar, {
      token: anahtar,
      reason,
      candidates: candidates.map((a) => ({ id: a.id, name: a.name })),
      count: 1,
      examples: [ornek],
    });
  };

  for (const ws of wb.worksheets) {
    if (ws.rowCount === 0) continue;
    let sayfaKullanildi = false;

    for (let r = 1; r <= ws.rowCount; r++) {
      for (let c = 1; c <= ws.columnCount; c++) {
        const hucre = ws.getCell(r, c).value;
        if (!(hucre instanceof Date)) continue;

        // Yalnızca saat içeren hücreler (örn "08:00") Excel'in sıfır
        // noktasına, 1899'a düşer. Bunlar gün değildir.
        const yil = hucre.getFullYear();
        if (yil < 2000 || yil > 2100) continue;

        const gun = isoDate(hucre);
        dates.add(gun);
        sayfaKullanildi = true;

        // Sütunda aşağı in; sonraki tarih hücresi bir sonraki haftadır.
        for (let r2 = r + 1; r2 <= ws.rowCount; r2++) {
          const alt = ws.getCell(r2, c).value;
          if (alt instanceof Date) break;

          const metin = cellText(alt).trim();
          if (!metin) continue;

          const ikiNokta = metin.indexOf(":");
          if (ikiNokta < 0) continue; // başlık/serbest not — görev satırı değil

          const etiket = metin.slice(0, ikiNokta).trim();
          const yer = labelToLocation(etiket);
          if (!yer) {
            const n = norm(etiket);
            const v = bilinmeyenEtiket.get(n);
            if (v) v.count++;
            else bilinmeyenEtiket.set(n, { count: 1, example: metin.slice(0, 60) });
            continue;
          }

          // Kişiler virgül/noktalı virgül/artı/eğik çizgi ile ayrılır.
          for (const obek of metin.slice(ikiNokta + 1).split(/[,;+/]/)) {
            // Öbek içinde boşluk ve tire ayırır ("YÖRE-EBRAR" iki kişidir),
            // tek harfli parçalar bir önceki adın baş harfidir ("MERVE E").
            // Bir hücrede birden çok görev olabiliyor ("ADLİ: X  ATİLA H: Y");
            // iki nokta ve parantezler isim parçası değildir.
            const kelimeler = obek
              .split(/[\s-]+/)
              .map((k) => k.replace(/[().:]/g, "").trim())
              .filter(Boolean);

            for (let i = 0; i < kelimeler.length; i++) {
              const kelime = kelimeler[i];
              const anahtar = norm(kelime);
              if (anahtar.length < 2) continue; // baş harf; adla birlikte işlenir

              const sonraki = kelimeler[i + 1];
              const basHarf = sonraki && norm(sonraki).length === 1 ? sonraki : undefined;

              // "FATMA BETÜL" gibi iki kelimelik yazımlar tek kişidir. İki
              // kelimenin aday kümeleri tek bir kişide kesişiyorsa onu alırız;
              // kesişmiyorsa ("AYSU MUSTAFA") iki ayrı kişidir.
              if (!basHarf && sonraki && norm(sonraki).length > 1) {
                const a1 = dizin.get(anahtar) ?? [];
                const a2 = dizin.get(norm(sonraki)) ?? [];
                const kesisim = a1.filter((x) => a2.some((y) => y.id === x.id));
                if (kesisim.length === 1) {
                  duties.push({
                    date: gun,
                    assistantId: kesisim[0].id,
                    assistantName: kesisim[0].name,
                    workLocation: yer,
                    label: etiket,
                  });
                  i++; // ikinci kelime de tüketildi
                  continue;
                }
              }

              // Kullanıcının bir kez tanımladığı eşleme her şeyin önünde gelir.
              const takmaAd = aliases.get(basHarf ? `${anahtar} ${norm(basHarf)}` : anahtar);
              if (takmaAd === null) continue; // "asistan değil, yok say"
              if (takmaAd !== undefined) {
                const kisi = assistants.find((a) => a.id === takmaAd);
                if (kisi) {
                  duties.push({
                    date: gun,
                    assistantId: kisi.id,
                    assistantName: kisi.name,
                    workLocation: yer,
                    label: etiket,
                  });
                  continue;
                }
              }

              const coz = (ad: string, harf?: string) => {
                const k = norm(ad);
                let adaylar = dizin.get(k) ?? [];
                if (adaylar.length > 1 && harf) {
                  const daraltilmis = narrowByInitial(adaylar, harf);
                  if (daraltilmis.length === 1) adaylar = daraltilmis;
                }

                if (adaylar.length === 1) {
                  duties.push({
                    date: gun,
                    assistantId: adaylar[0].id,
                    assistantName: adaylar[0].name,
                    workLocation: yer,
                    label: etiket,
                  });
                  return;
                }
                if (adaylar.length > 1) {
                  notResolved(harf ? `${ad} ${harf}` : ad, "belirsiz", adaylar, metin.slice(0, 60));
                  return;
                }

                // Tanınmadı: ayırıcısı unutulmuş bitişik yazım olabilir.
                const parcalar = splitJoined(k, dizin);
                if (parcalar) {
                  for (const p of parcalar) coz(p);
                  return;
                }
                notResolved(ad, "taninmiyor", [], metin.slice(0, 60));
              };

              coz(kelime, basHarf);
            }
          }
        }
      }
    }
    if (sayfaKullanildi) sheetNames.push(ws.name);
  }

  return {
    duties,
    unresolved: [...cozulemeyen.values()].sort((a, b) => b.count - a.count),
    unknownLabels: [...bilinmeyenEtiket.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.count - a.count),
    dates: [...dates].sort(),
    sheetNames,
  };
}

/** Yalnızca muafiyet doğuran görevler veritabanına yazılır. */
export function exemptOnly(duties: ParsedDuty[]): ParsedDuty[] {
  return duties.filter((d) => isExempt(d.workLocation));
}
