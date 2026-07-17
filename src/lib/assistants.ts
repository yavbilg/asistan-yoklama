export interface Assistant {
  id: number;
  name: string;
  endDate: string; // DD.MM.YY format
}

export const assistants: Assistant[] = [
  { id: 1, name: "Bülbül Aliyeva", endDate: "16.02.22" },
  { id: 2, name: "Afra Nur Arslan", endDate: "28.06.22" },
  { id: 3, name: "Cengizhan Yener", endDate: "27.06.22" },
  { id: 4, name: "Hasancan Başkurt", endDate: "18.07.22" },
  { id: 5, name: "Çağdaş İsahan Erün", endDate: "27.12.22" },
  { id: 6, name: "Cüneyt Yüksel", endDate: "27.12.22" },
  { id: 7, name: "Halise Yener", endDate: "30.12.22" },
  { id: 8, name: "Sueda Zeynep Kelebek", endDate: "11.08.23" },
  { id: 9, name: "Ceren Muşmuloğlu", endDate: "14.08.23" },
  { id: 10, name: "Şefika Rumeysa İspirden", endDate: "05.09.23" },
  { id: 11, name: "Jehan Shukraan Khudhur", endDate: "12.09.23" },
  { id: 12, name: "Atakan Kaltakkıran", endDate: "12.09.23" },
  { id: 13, name: "Mehtap Halıcı", endDate: "03.10.23" },
  { id: 14, name: "Ebrar Özhan", endDate: "09.01.24" },
  { id: 15, name: "Aysu Eseler", endDate: "11.01.24" },
  { id: 16, name: "Demir Gümüşdağ", endDate: "30.01.24" },
  { id: 17, name: "Mustafa Güney", endDate: "02.02.24" },
  { id: 18, name: "Alphan Derici", endDate: "11.01.24" },
  { id: 19, name: "Fatma Betül Can", endDate: "04.09.23" },
  { id: 20, name: "Fuad Mammadlı", endDate: "17.07.23" },
  { id: 21, name: "Merve Özçiftci", endDate: "09.08.24" },
  { id: 22, name: "Özge Varol", endDate: "09.08.24" },
  { id: 23, name: "Artun Vardar", endDate: "12.08.24" },
  { id: 24, name: "Yöre Ülgüdür Çetin", endDate: "12.08.24" },
  { id: 25, name: "Sena Bilgiç", endDate: "14.08.24" },
  { id: 26, name: "Şenay Taşkın", endDate: "09.09.24" },
  { id: 27, name: "Gökhan Çınar", endDate: "10.09.24" },
  { id: 28, name: "İlkay Emre Çodur", endDate: "08.08.24" },
  { id: 29, name: "İrem Elgörmüş Zafer", endDate: "11.01.24" },
  { id: 30, name: "Cansu Kalelioğlu", endDate: "06.09.24" },
  { id: 31, name: "Ekin Özmen", endDate: "11.12.24" },
  { id: 32, name: "İclal Karacan Öztürk", endDate: "21.12.24" },
  { id: 33, name: "Arzu Gür", endDate: "08.01.25" },
  { id: 34, name: "Yasin Gürleyen", endDate: "06.01.25" },
  { id: 35, name: "Betül Gizem Cevahir", endDate: "11.08.25" },
  { id: 36, name: "Berkan Sami Öztürk", endDate: "21.08.25" },
  { id: 37, name: "Nisa Söğüt", endDate: "10.11.25" },
  { id: 38, name: "Hümeyra Türkyılmaz", endDate: "13.11.25" },
  { id: 39, name: "Sema Nur Aslan", endDate: "14.11.25" },
  { id: 40, name: "Kübranur Yerlikaya", endDate: "19.11.25" },
  { id: 41, name: "Nida Erdem", endDate: "21.11.25" },
  { id: 42, name: "Merve Eroğlu", endDate: "21.11.25" },
  { id: 43, name: "Feride Aydınoğlu", endDate: "21.11.25" },
  { id: 44, name: "Sümeyye Gerçekçioğlu", endDate: "21.11.25" },
  { id: 45, name: "Semih Gezmişoğlu", endDate: "12.12.25" },
  { id: 46, name: "Hatice İhlas Ekinci", endDate: "12.12.25" },
  { id: 47, name: "Nazlı Nehir", endDate: "29.06.26" },
  { id: 48, name: "Rabia Nur Berta", endDate: "29.06.26" },
];

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
] as const;

export type WorkLocation = (typeof WORK_LOCATIONS)[number];

export const EXEMPT_LOCATIONS: WorkLocation[] = [
  "Poliklinik",
  "Asker/Adli",
  "Konsültasyon",
  "R-Nöroloji",
  "TRSM",
  "Çoc. Psikiyatrisi",
];

export function isExempt(location: WorkLocation | string): boolean {
  return EXEMPT_LOCATIONS.includes(location as WorkLocation);
}

// Temmuz 2026 çalışma yeri haritası (Google Sheets'ten alındı)
export const CURRENT_WORK_LOCATIONS: Record<number, WorkLocation> = {
  1: "TRSM",             // Bülbül Aliyeva
  3: "Asker/Adli",       // Cengizhan Yener
  4: "Poliklinik",       // Hasancan Başkurt
  5: "TRSM",             // Çağdaş İsahan Erün
  6: "Poliklinik",       // Cüneyt Yüksel
  11: "Asker/Adli",      // Jehan Shukraan Khudhur
  14: "R-Nöroloji",      // Ebrar Özhan
  15: "Asker/Adli",      // Aysu Eseler
  17: "R-Nöroloji",      // Mustafa Güney
  18: "Poliklinik",      // Alphan Derici
  19: "Asker/Adli",      // Fatma Betül Can
  20: "Çoc. Psikiyatrisi", // Fuad Mammadlı
  21: "Poliklinik",      // Merve Özçiftci
  22: "Poliklinik",      // Özge Varol
  26: "Konsültasyon",    // Şenay Taşkın
  27: "Poliklinik",      // Gökhan Çınar
  28: "Asker/Adli",      // İlkay Emre Çodur
  29: "Poliklinik",      // İrem Elgörmüş Zafer
  30: "Poliklinik",      // Cansu Kalelioğlu
  32: "Poliklinik",      // İclal Karacan Öztürk
  33: "Çoc. Psikiyatrisi", // Arzu Gür
  34: "Konsültasyon",    // Yasin Gürleyen
};
