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
  "Nöbet Ertesi",
  "Kıdemli",
] as const;

export type WorkLocation = (typeof WORK_LOCATIONS)[number];

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

export function getSeniorAssistantIds(): number[] {
  const now = new Date();
  const ids: number[] = [];
  for (const a of assistants) {
    const parts = a.endDate.split(".");
    if (parts.length !== 3) continue;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = 2000 + parseInt(parts[2], 10);
    const start = new Date(year, month, day);
    const diffMs = now.getTime() - start.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    if (diffMonths > 42) {
      ids.push(a.id);
    }
  }
  return ids;
}

export const STATIC_EXEMPT: Record<number, WorkLocation> = {
  14: "Çoc. Psikiyatrisi",
  17: "Çoc. Psikiyatrisi",
  29: "Çoc. Psikiyatrisi",
  33: "Çoc. Psikiyatrisi",
};

// Günlük programdaki kısa isimler -> asistan ID eşleştirmesi
export const SCHEDULE_NAME_MAP: Record<string, number> = {
  "BÜLBÜL": 1,
  "AFRA": 2,
  "CENGİZHAN": 3,
  "HASANCAN": 4,
  "ÇAĞDAŞ": 5,
  "CÜNEYT": 6,
  "HALİSE": 7,
  "CEREN": 9,
  "RUMEYSA": 10,
  "RÜMEYSA": 10,
  "JEHAN": 11,
  "ATAKAN": 12,
  "MEHTAP": 13,
  "EBRAR": 14,
  "AYSU": 15,
  "DEMİR": 16,
  "MUSTAFA": 17,
  "ALPHAN": 18,
  "FUAD": 20,
  "MERVE": 21,
  "ÖZGE": 22,
  "ARTUN": 23,
  "YÖRE": 24,
  "SENA": 25,
  "ŞENAY": 26,
  "GÖKHAN": 27,
  "İLKAY": 28,
  "CANSU": 30,
  "EKİN": 31,
  "İCLAL": 32,
  "ARZU": 33,
  "YASİN": 34,
  "GİZEM": 35,
  "BETÜL": 35,
  "BERKAN": 36,
  "NİSA": 37,
  "HÜMEYRA": 38,
  "SEMA": 39,
  "KÜBRANUR": 40,
  "KÜBRA": 40,
  "NİDA": 41,
  "FERİDE": 43,
  "SÜMEYYE": 44,
  "SEMİH": 45,
  "İHLAS": 46,
  "NAZLI": 47,
  "RABİA": 48,
};

export function parseScheduleAssignments(cells: string[]): Record<number, WorkLocation> {
  const result: Record<number, WorkLocation> = {};

  for (const raw of cells) {
    const text = raw.trim();
    if (!text) continue;

    let location: WorkLocation | null = null;
    let namesPart = "";
    const upper = text.toUpperCase();

    if (upper.startsWith("N.E")) {
      location = "Nöbet";
      namesPart = text.replace(/^N\.E\.?\s*:?\s*/i, "");
    } else if (upper.startsWith("İZİN")) {
      location = "İzin/Rapor";
      namesPart = text.replace(/^İZİN\s*:?\s*/i, "");
    } else if (upper.indexOf("ADLİ") >= 0) {
      location = "Asker/Adli";
      namesPart = text.replace(/^.*?:\s*/, "");
    } else if (upper.indexOf("AMATEM") >= 0) {
      location = "Pol-AMATEM";
      namesPart = text.replace(/^.*?:\s*/, "");
    } else if (upper.indexOf("MERKEZ KONS") >= 0) {
      location = "Konsültasyon";
      namesPart = text.replace(/^.*?:\s*/, "");
    } else if (upper.indexOf("KORUCUK KONS") >= 0) {
      location = "Konsültasyon";
      namesPart = text.replace(/^.*?:\s*/, "");
    } else if (upper.indexOf("TRSM") >= 0) {
      location = "TRSM";
      const afterTrsm = text.replace(/^.*TRSM\s*:?\s*/i, "");
      namesPart = afterTrsm;
    } else if (/ATİLA|ALİ H|ESRA H|YAVUZ/i.test(upper)) {
      location = "Poliklinik";
      namesPart = text.replace(/^.*?:\s*/, "");
    } else {
      continue;
    }

    if (!location || !namesPart) continue;

    const names = namesPart.split(/[\s,]+/).filter((n) => n.length > 1);
    for (const name of names) {
      const normalized = name.toUpperCase().replace(/[()]/g, "");
      const id = SCHEDULE_NAME_MAP[normalized];
      if (id && id > 0) {
        result[id] = location;
      }
    }
  }

  return result;
}

// Geriye uyumluluk için CURRENT_WORK_LOCATIONS (statik muaf + boş)
export const CURRENT_WORK_LOCATIONS: Record<number, WorkLocation> = { ...STATIC_EXEMPT };
