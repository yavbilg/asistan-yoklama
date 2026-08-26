/**
 * Çalışma yerleri ve muafiyet kuralları.
 *
 * Asistan listesi burada değil, veritabanındadır (/asistanlar ekranından
 * yönetilir). İlk kurulum listesi scripts/seed-assistants.json içinde durur.
 */

export const WORK_LOCATIONS = [
  "Eğitim",
  "Poliklinik",
  "Asker/Adli",
  "Konsültasyon",
  "R-Nöroloji",
  "TRSM",
  "Çoc. Psikiyatrisi",
  "AMATEM",
  "Pol-AMATEM",
  "S.-AMATEM",
  "İzin/Rapor",
  "Nöbet",
  "Nöbet Ertesi",
  "Kıdemli",
] as const;

export type WorkLocation = (typeof WORK_LOCATIONS)[number];

/** Bu yerlerde görevli olan asistan derse katılamaz, muaf sayılır. */
export const EXEMPT_LOCATIONS: WorkLocation[] = [
  "Poliklinik",
  "Asker/Adli",
  "Konsültasyon",
  "R-Nöroloji",
  "TRSM",
  "Çoc. Psikiyatrisi",
  "Pol-AMATEM",
  "Nöbet",
  "Nöbet Ertesi",
  "İzin/Rapor",
  "Kıdemli",
];

export function isExempt(location: WorkLocation | string): boolean {
  return EXEMPT_LOCATIONS.includes(location as WorkLocation);
}

/** Kalıcı görevlendirmeler: bu kişiler her oturumda muaf başlar. */
export const STATIC_EXEMPT: Record<number, WorkLocation> = {
  14: "Çoc. Psikiyatrisi",
  17: "Çoc. Psikiyatrisi",
  29: "Çoc. Psikiyatrisi",
  33: "Çoc. Psikiyatrisi",
};
