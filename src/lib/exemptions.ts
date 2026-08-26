import type { Assistant, AttendanceRecord } from "./db";
import { STATIC_EXEMPT, isExempt, type WorkLocation } from "./assistants";

/** Kıdem eşiği: bu süreyi dolduran asistan derslerden muaf sayılır. */
const KIDEM_AY = 42;

function aySayisi(endDate: string, now: Date): number | null {
  const p = endDate.split(".");
  if (p.length !== 3) return null;
  const gun = parseInt(p[0], 10);
  const ay = parseInt(p[1], 10) - 1;
  const yil = 2000 + parseInt(p[2], 10);
  if (!Number.isFinite(gun) || !Number.isFinite(ay) || !Number.isFinite(yil)) return null;
  const baslangic = new Date(yil, ay, gun);
  return (now.getTime() - baslangic.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

export function isSenior(assistant: Assistant, now = new Date()): boolean {
  const ay = aySayisi(assistant.endDate, now);
  return ay !== null && ay > KIDEM_AY;
}

/**
 * Yeni oturum açılırken herkesin başlangıç durumu.
 *
 * Muafiyet üç kaynaktan gelir, öncelik sırasıyla:
 *   1. Günlük görev çizelgesi (nöbet, izin, poliklinik…) — en güncel bilgi
 *   2. Sabit görevlendirmeler (STATIC_EXEMPT)
 *   3. Kıdem (42 ayı dolduranlar)
 * Hiçbiri yoksa kişi YOK başlar ve yoklamada işaretlenir.
 */
export function initialAttendance(
  assistants: Assistant[],
  gunlukGorev: Record<number, WorkLocation> = {},
  now = new Date()
): AttendanceRecord[] {
  const stamp = now.toISOString();

  return assistants.map((a) => {
    const yer: WorkLocation | undefined =
      gunlukGorev[a.id] ??
      (STATIC_EXEMPT[a.id] as WorkLocation | undefined) ??
      (isSenior(a, now) ? "Kıdemli" : undefined);

    if (yer && isExempt(yer)) {
      return { assistantId: a.id, status: "muaf" as const, workLocation: yer, timestamp: stamp };
    }
    return { assistantId: a.id, status: "yok" as const };
  });
}
