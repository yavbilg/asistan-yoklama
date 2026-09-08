import ExcelJS from "exceljs";
import { Assistant, Session, Status } from "./db";

const STATUS_LABEL: Record<Status, string> = {
  var: "VAR",
  yok: "YOK",
  muaf: "MUAF",
};

const FILL: Record<Status, string> = {
  var: "FFD8F0DC",
  yok: "FFF8D7DA",
  muaf: "FFFDECC8",
};

export function trDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Saatler veritabanında UTC saklanır. Bu dosya SUNUCUDA üretiliyor ve Vercel
 * işlevleri UTC çalışıyor; yerel saate çevirmek yerine saat dilimini açıkça
 * veriyoruz, yoksa çıktı üç saat geri görünüyor.
 */
const SAAT_BICIMI = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function trTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return SAAT_BICIMI.format(d);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFF2" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB0B6BE" } } };
  });
}

/** Tek oturumun yoklama listesi. Eski CSV ile aynı sütun düzeni. */
export function buildSessionSheet(
  wb: ExcelJS.Workbook,
  session: Session,
  assistants: Assistant[],
  sheetName?: string
) {
  // Excel sayfa adı 31 karakteri geçemez ve  : \ / ? * [ ] kabul etmez.
  const raw = sheetName ?? `${session.lessonName} ${trDate(session.date)}`;
  const safeName = raw.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);

  const ws = wb.addWorksheet(safeName);

  ws.addRow([session.lessonName]).font = { bold: true, size: 14 };
  ws.addRow([`${trDate(session.date)}  ${session.startTime} - ${session.endTime}`]);
  ws.addRow([]);

  const header = ws.addRow(["Ad Soyad", "Durum", "Çalışma Yeri", "Saat"]);
  styleHeader(header);

  const byId = new Map(session.attendance.map((a) => [a.assistantId, a]));

  // İşaretlenmemiş kişiler de listede görünsün, boş kalmasın.
  for (const person of assistants) {
    const rec = byId.get(person.id);
    const row = ws.addRow([
      person.name,
      rec ? STATUS_LABEL[rec.status] : "-",
      rec?.workLocation || "-",
      trTime(rec?.timestamp),
    ]);
    if (rec) {
      row.getCell(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: FILL[rec.status] },
      };
    }
  }

  const counts = { var: 0, yok: 0, muaf: 0 };
  for (const a of session.attendance) counts[a.status]++;

  ws.addRow([]);
  ws.addRow([
    "Toplam",
    `VAR: ${counts.var}`,
    `YOK: ${counts.yok}`,
    `MUAF: ${counts.muaf}`,
  ]).font = { bold: true };

  ws.columns = [{ width: 28 }, { width: 12 }, { width: 18 }, { width: 10 }];
  return ws;
}

export async function sessionWorkbook(
  session: Session,
  assistants: Assistant[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Asistan Yoklama";
  buildSessionSheet(wb, session, assistants, "Yoklama");
  return wb.xlsx.writeBuffer();
}

/**
 * Dönem raporu: ilk sayfa asistan × oturum matrisi ve devam oranı,
 * ardından her oturumun kendi detay sayfası.
 */
export async function overallWorkbook(
  sessions: Session[],
  assistants: Assistant[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Asistan Yoklama";

  const ws = wb.addWorksheet("Özet");
  const ordered = [...sessions].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
  );

  const header = ws.addRow([
    "Ad Soyad",
    ...ordered.map((s) => `${s.lessonName}\n${trDate(s.date)}`),
    "VAR",
    "YOK",
    "MUAF",
    "Devam %",
  ]);
  styleHeader(header);
  header.alignment = { wrapText: true, vertical: "middle" };

  const lookup = new Map(
    ordered.map((s) => [s.id, new Map(s.attendance.map((a) => [a.assistantId, a]))])
  );

  for (const person of assistants) {
    const cells: string[] = [];
    const counts = { var: 0, yok: 0, muaf: 0 };

    for (const s of ordered) {
      const rec = lookup.get(s.id)?.get(person.id);
      if (rec) {
        counts[rec.status]++;
        cells.push(STATUS_LABEL[rec.status]);
      } else {
        cells.push("-");
      }
    }

    // Muaf olunan oturumlar oranın dışında tutulur.
    const payda = counts.var + counts.yok;
    const oran = payda ? Math.round((counts.var / payda) * 100) : null;

    const row = ws.addRow([
      person.name,
      ...cells,
      counts.var,
      counts.yok,
      counts.muaf,
      oran === null ? "-" : oran / 100,
    ]);

    ordered.forEach((s, i) => {
      const rec = lookup.get(s.id)?.get(person.id);
      if (rec) {
        row.getCell(i + 2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: FILL[rec.status] },
        };
      }
    });

    if (oran !== null) row.getCell(ordered.length + 5).numFmt = "0%";
  }

  ws.getColumn(1).width = 28;
  for (let i = 0; i < ordered.length; i++) ws.getColumn(i + 2).width = 14;
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  for (const s of ordered) {
    buildSessionSheet(wb, s, assistants);
  }

  return wb.xlsx.writeBuffer();
}
