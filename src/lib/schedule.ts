export interface ScheduledLesson {
  dayOfWeek: number; // 0=Pazar, 1=Pazartesi, 2=Salı, 3=Çarşamba, 4=Perşembe, 5=Cuma, 6=Cumartesi
  startTime: string;
  endTime: string;
  lessonName: string;
}

export const WEEKLY_SCHEDULE: ScheduledLesson[] = [
  { dayOfWeek: 2, startTime: "13:00", endTime: "14:00", lessonName: "Seminer" },
  { dayOfWeek: 4, startTime: "13:00", endTime: "14:00", lessonName: "Yavuz Hoca Ders" },
  { dayOfWeek: 5, startTime: "10:00", endTime: "11:00", lessonName: "Atila Hoca Ders" },
  { dayOfWeek: 5, startTime: "11:00", endTime: "12:00", lessonName: "Asistan Vaka Sunumu" },
  { dayOfWeek: 5, startTime: "14:00", endTime: "16:00", lessonName: "Esra-Ahmet Hoca Ders" },
];

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek];
}

export function getTodaysLessons(): ScheduledLesson[] {
  const today = new Date().getDay();
  return WEEKLY_SCHEDULE.filter((l) => l.dayOfWeek === today);
}

export function getUpcomingLessons(monthsAhead: number = 3): { date: string; lesson: ScheduledLesson }[] {
  const results: { date: string; lesson: ScheduledLesson }[] = [];
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + monthsAhead);

  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];
    for (const lesson of WEEKLY_SCHEDULE) {
      if (lesson.dayOfWeek === dayOfWeek) {
        results.push({ date: dateStr, lesson });
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return results;
}
