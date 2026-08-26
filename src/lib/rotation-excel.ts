import ExcelJS from "exceljs";
import type { Assistant } from "./db";
import type { WorkLocation } from "./assistants";

/**
 * Aylık dış rotasyon listesini okur.
 *
 * Dosya düzeni: sütunlar birim (Kadın Serv., Nöroloji, Çoc. Psk. …),
 * satırlar kişi. İsimler "BG.Cevahir", "İEÇodur", "S.N.Aslan" gibi
 * baş harf + soyad biçiminde — günlük çizelgedeki ilk-ad biçiminden farklı,
 * bu yüzden ayrı bir eşleştirici kullanılıyor.
 */

/**
 * Yalnızca bu birimler muafiyet doğurur: asistan başka bir kurumda/binada
 * olduğu için derse gelemez. Servisler, poliklinik ve AMATEM listede yok —
 * onlar hastane içindedir ve derse katılırlar.
 */
const EXEMPT_UNITS: { test: RegExp; yer: WorkLocation }[] = [
  { test: /NOROLOJ/, yer: "R-Nöroloji" },
  { test: /COC|COCUK|C\.?\s*PSK/, yer: "Çoc. Psikiyatrisi" },
  { test: /TRSM/, yer: "TRSM" },
  { test: /IZIN|RAPOR|LISTE DISI/, yer: "İzin/Rapor" },
];

const AYLAR = [
  "OCAK", "SUBAT", "MART", "NISAN", "MAYIS", "HAZIRAN",
  "TEMMUZ", "AGUSTOS", "EYLUL", "EKIM", "KASIM", "ARALIK",
];

export interface RotationEntry {
  assistantId: number;
  assistantName: string;
  unit: string;
  workLocation: WorkLocation;
}

export interface RotationParseResult {
  entries: RotationEntry[];
  startDate: string;
  endDate: string;
  monthLabel: string;
  unresolved: { token: string; unit: string; candidates: { id: number; name: string }[] }[];
  /** Muafiyet doğurmayan birimler — bilgi amaçlı gösterilir. */
  skippedUnits: { unit: string; people: number }[];
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

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return "";
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join("");
    }
    if ("result" in v && v.result != null) return String(v.result);
    return "";
  }
  return String(v);
}

/** "Ağustos 26" / "Ağustos 2026" → ayın ilk ve son günü */
function parseMonth(label: string): { start: string; end: string; label: string } | null {
  const n = norm(label);
  const m = n.match(/([A-Z]+)\s*(\d{2,4})/);
  if (!m) return null;
  const ay = AYLAR.indexOf(m[1]);
  if (ay < 0) return null;

  const ham = Number(m[2]);
  const yil = ham < 100 ? 2000 + ham : ham;
  const sonGun = new Date(yil, ay + 1, 0).getDate();
  const iki = (x: number) => String(x).padStart(2, "0");

  return {
    start: `${yil}-${iki(ay + 1)}-01`,
    end: `${yil}-${iki(ay + 1)}-${iki(sonGun)}`,
    label: `${m[1].charAt(0)}${m[1].slice(1).toLocaleLowerCase("tr")} ${yil}`,
  };
}

/**
 * "BG.Cevahir" → soyad "CEVAHIR", baş harfler "BG"
 * "İEÇodur"   → noktasız yazım; sondaki büyük-küçük harf öbeği soyaddır
 * "ÇRS İREM"  → ön ek atılır, kalan tek ad olarak denenir
 */
function parseName(ham: string): { surname: string; initials: string } | null {
  let s = ham.trim().replace(/^ÇRS\s+/i, "");
  if (!s) return null;

  if (s.includes(".")) {
    const parcalar = s.split(".").map((p) => p.trim()).filter(Boolean);
    if (parcalar.length === 0) return null;
    const soyad = parcalar[parcalar.length - 1];
    return { surname: norm(soyad), initials: norm(parcalar.slice(0, -1).join("")) };
  }

  // Noktasız: "İEÇodur" → baştaki büyük harfler baş harf, sonrası soyad.
  const m = s.match(/^([A-ZÇĞİÖŞÜ]+?)([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)$/);
  if (m) return { surname: norm(m[2]), initials: norm(m[1]) };

  s = s.replace(/\s+/g, " ");
  return { surname: norm(s), initials: "" };
}

/** Ad parçalarına göre dizin — soyad, ikinci ad, ilk ad hepsi anahtar. */
function buildIndex(assistants: Assistant[]): Map<string, Assistant[]> {
  const dizin = new Map<string, Assistant[]>();
  for (const a of assistants) {
    for (const p of norm(a.name).split(" ")) {
      if (p.length < 2) continue;
      const l = dizin.get(p);
      if (l) l.push(a);
      else dizin.set(p, [a]);
    }
  }
  return dizin;
}

function resolve(
  ham: string,
  dizin: Map<string, Assistant[]>
): { kisi?: Assistant; adaylar: Assistant[] } {
  const ad = parseName(ham);
  if (!ad) return { adaylar: [] };

  let adaylar = dizin.get(ad.surname) ?? [];
  if (adaylar.length === 0) return { adaylar: [] };
  if (adaylar.length === 1) return { kisi: adaylar[0], adaylar };

  // Birden çok aday: baş harfler ayırır ("BS.Öztürk" / "İ.Karacan").
  if (ad.initials) {
    const harfler = [...ad.initials];
    const daraltilmis = adaylar.filter((a) => {
      const parcalar = norm(a.name).split(" ");
      return harfler.every((h) => parcalar.some((p) => p.startsWith(h)));
    });
    if (daraltilmis.length === 1) return { kisi: daraltilmis[0], adaylar };
    if (daraltilmis.length > 0) adaylar = daraltilmis;
  }
  return { adaylar };
}

export async function parseRotationWorkbook(
  buffer: ArrayBuffer,
  assistants: Assistant[]
): Promise<RotationParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Sayfa yok");

  const dizin = buildIndex(assistants);

  // Ay etiketi ilk sütunlarda tekrarlanıyor ("Ağustos 26").
  let donem: ReturnType<typeof parseMonth> = null;
  for (let r = 1; r <= Math.min(ws.rowCount, 20) && !donem; r++) {
    for (let c = 1; c <= 2; c++) {
      const t = cellText(ws.getCell(r, c).value).trim();
      if (t) {
        const d = parseMonth(t);
        if (d) {
          donem = d;
          break;
        }
      }
    }
  }
  if (!donem) throw new Error("Dosyada ay bilgisi bulunamadı (örn 'Ağustos 26').");

  const entries: RotationEntry[] = [];
  const unresolved: RotationParseResult["unresolved"] = [];
  const skipped = new Map<string, number>();
  const eklenen = new Set<number>();

  for (let c = 1; c <= ws.columnCount; c++) {
    // Birim adı 1. ya da 2. satırda; rol satırı (3) "Eğit." ise atlanır.
    const birim = (cellText(ws.getCell(1, c).value) || cellText(ws.getCell(2, c).value)).trim();
    if (!birim) continue;

    const rol = norm(cellText(ws.getCell(3, c).value));
    if (rol.startsWith("EGIT")) continue; // eğitim görevlisi sütunu, asistan değil

    const kural = EXEMPT_UNITS.find((k) => k.test.test(norm(birim)));

    const isimler: string[] = [];
    for (let r = 4; r <= ws.rowCount; r++) {
      const t = cellText(ws.getCell(r, c).value).trim();
      if (t && !parseMonth(t)) isimler.push(t);
    }
    if (isimler.length === 0) continue;

    if (!kural) {
      skipped.set(birim, (skipped.get(birim) ?? 0) + isimler.length);
      continue;
    }

    for (const ham of isimler) {
      const { kisi, adaylar } = resolve(ham, dizin);
      if (kisi) {
        // Aynı kişi iki muaf birimde görünürse ilki geçerli sayılır.
        if (eklenen.has(kisi.id)) continue;
        eklenen.add(kisi.id);
        entries.push({
          assistantId: kisi.id,
          assistantName: kisi.name,
          unit: birim,
          workLocation: kural.yer,
        });
      } else {
        unresolved.push({
          token: ham,
          unit: birim,
          candidates: adaylar.map((a) => ({ id: a.id, name: a.name })),
        });
      }
    }
  }

  return {
    entries,
    startDate: donem.start,
    endDate: donem.end,
    monthLabel: donem.label,
    unresolved,
    skippedUnits: [...skipped.entries()].map(([unit, people]) => ({ unit, people })),
  };
}
