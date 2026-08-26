import postgres from "postgres";

// Tembel başlatma: bağlantı ilk sorguda kurulur. Modül import edilir edilmez
// hata fırlatırsa DATABASE_URL'siz ortamda `next build` de patlar.
type Row = Record<string, unknown>;

/** Sürücünün dönüş tipini tek satır tipine indirgeyip sadeleştiriyoruz. */
interface Sql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  unsafe(text: string, params?: unknown[]): Promise<Row[]>;
}

let client: postgres.Sql | null = null;

function db(): postgres.Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL tanımlı değil. Yerelde .env.local dosyasına, Vercel'de proje ayarlarına ekleyin."
      );
    }
    client = postgres(url, {
      ssl: "require",
      // Serverless'ta her istek ayrı bir işlev örneğinde çalışır; örnek başına
      // tek bağlantı tutup boşta kalanı hızla bırakıyoruz.
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      // Havuzlayıcı üzerinden geçerken hazırlanmış ifadeler sorun çıkarır.
      prepare: false,
    });
  }
  return client;
}

export const sql: Sql = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]) =>
    db()(strings, ...(values as never[])) as unknown as Promise<Row[]>,
  {
    unsafe: (text: string, params?: unknown[]) =>
      db().unsafe(text, params as never[]) as unknown as Promise<Row[]>,
  }
);

/* ---------- Tipler ---------- */

export type Status = "var" | "yok" | "muaf";

export interface Assistant {
  id: number;
  name: string;
  endDate: string;
  active: boolean;
}

export interface AttendanceRecord {
  assistantId: number;
  status: Status;
  workLocation?: string;
  timestamp?: string;
}

export interface Session {
  id: string;
  lessonName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  createdAt: string;
  active: boolean;
  attendance: AttendanceRecord[];
}

export interface SessionSummary extends Omit<Session, "attendance"> {
  counts: { var: number; yok: number; muaf: number };
}

/* ---------- Asistanlar ---------- */

export async function listAssistants(includeInactive = false): Promise<Assistant[]> {
  const rows = includeInactive
    ? await sql`SELECT id, name, end_date, active FROM assistants ORDER BY id`
    : await sql`SELECT id, name, end_date, active FROM assistants WHERE active ORDER BY id`;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    endDate: (r.end_date as string) ?? "",
    active: r.active as boolean,
  }));
}

export async function createAssistant(name: string, endDate: string): Promise<Assistant> {
  const [r] = await sql`
    INSERT INTO assistants (name, end_date) VALUES (${name}, ${endDate})
    RETURNING id, name, end_date, active
  `;
  return {
    id: r.id as number,
    name: r.name as string,
    endDate: (r.end_date as string) ?? "",
    active: r.active as boolean,
  };
}

export async function updateAssistant(
  id: number,
  fields: { name?: string; endDate?: string; active?: boolean }
): Promise<void> {
  // COALESCE ile yalnızca gönderilen alanlar değişir.
  await sql`
    UPDATE assistants SET
      name     = COALESCE(${fields.name ?? null}, name),
      end_date = COALESCE(${fields.endDate ?? null}, end_date),
      active   = COALESCE(${fields.active ?? null}, active)
    WHERE id = ${id}
  `;
}

/** Asistan silinmez, pasife alınır — geçmiş yoklama kayıtları korunsun diye. */
export async function deactivateAssistant(id: number): Promise<void> {
  await sql`UPDATE assistants SET active = FALSE WHERE id = ${id}`;
}

/* ---------- Oturumlar ---------- */


interface SessionRow {
  id: string;
  lesson_name: string;
  date: string;
  start_time: string;
  end_time: string;
  created_at: string | Date;
  active: boolean;
}

function toSessionBase(r: SessionRow) {
  return {
    id: r.id,
    lessonName: r.lesson_name,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    createdAt: new Date(r.created_at).toISOString(),
    active: r.active,
  };
}

export async function listSessions(limit = 100): Promise<SessionSummary[]> {
  // Sayımlar tek sorguda geliyor; eskisi gibi her oturum için ayrı istek yok.
  const rows = (await sql`
    SELECT
      s.id, s.lesson_name,
      to_char(s.date, 'YYYY-MM-DD')    AS date,
      to_char(s.start_time, 'HH24:MI') AS start_time,
      to_char(s.end_time, 'HH24:MI')   AS end_time,
      s.created_at, s.active,
      COUNT(*) FILTER (WHERE a.status = 'var')  AS c_var,
      COUNT(*) FILTER (WHERE a.status = 'yok')  AS c_yok,
      COUNT(*) FILTER (WHERE a.status = 'muaf') AS c_muaf
    FROM sessions s
    LEFT JOIN attendance a ON a.session_id = s.id
    GROUP BY s.id
    ORDER BY s.date DESC, s.start_time DESC
    LIMIT ${limit}
  `) as unknown as (SessionRow & { c_var: string; c_yok: string; c_muaf: string })[];

  return rows.map((r) => ({
    ...toSessionBase(r),
    counts: {
      var: Number(r.c_var),
      yok: Number(r.c_yok),
      muaf: Number(r.c_muaf),
    },
  }));
}

export async function getSession(id: string): Promise<Session | null> {
  const rows = (await sql`
    SELECT id, lesson_name,
           to_char(date, 'YYYY-MM-DD')    AS date,
           to_char(start_time, 'HH24:MI') AS start_time,
           to_char(end_time, 'HH24:MI')   AS end_time,
           created_at, active
    FROM sessions WHERE id = ${id}
  `) as unknown as SessionRow[];
  if (rows.length === 0) return null;

  const attendance = await getAttendance(id);
  return { ...toSessionBase(rows[0]), attendance };
}

export async function getActiveSession(): Promise<Session | null> {
  const rows = (await sql`
    SELECT id, lesson_name,
           to_char(date, 'YYYY-MM-DD')    AS date,
           to_char(start_time, 'HH24:MI') AS start_time,
           to_char(end_time, 'HH24:MI')   AS end_time,
           created_at, active
    FROM sessions WHERE active ORDER BY created_at DESC LIMIT 1
  `) as unknown as SessionRow[];
  if (rows.length === 0) return null;

  const attendance = await getAttendance(rows[0].id);
  return { ...toSessionBase(rows[0]), attendance };
}

export async function createSession(input: {
  id: string;
  lessonName: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<Session> {
  // Aynı ders/tarih/saat zaten varsa yenisini açmaz, mevcudu döndürür.
  const rows = (await sql`
    INSERT INTO sessions (id, lesson_name, date, start_time, end_time)
    VALUES (${input.id}, ${input.lessonName}, ${input.date}, ${input.startTime}, ${input.endTime})
    ON CONFLICT (lesson_name, date, start_time) DO UPDATE SET active = TRUE
    RETURNING id, lesson_name,
              to_char(date, 'YYYY-MM-DD')    AS date,
              to_char(start_time, 'HH24:MI') AS start_time,
              to_char(end_time, 'HH24:MI')   AS end_time,
              created_at, active
  `) as unknown as SessionRow[];

  const attendance = await getAttendance(rows[0].id);
  return { ...toSessionBase(rows[0]), attendance };
}

export async function endSession(id: string): Promise<void> {
  await sql`UPDATE sessions SET active = FALSE WHERE id = ${id}`;
}

export async function deactivateAllSessions(): Promise<void> {
  await sql`UPDATE sessions SET active = FALSE WHERE active`;
}

/* ---------- Yoklama ---------- */

export async function getAttendance(sessionId: string): Promise<AttendanceRecord[]> {
  const rows = await sql`
    SELECT assistant_id, status, work_location, marked_at
    FROM attendance WHERE session_id = ${sessionId}
  `;
  return rows.map((r) => ({
    assistantId: r.assistant_id as number,
    status: r.status as Status,
    workLocation: (r.work_location as string) ?? "",
    timestamp: r.marked_at ? new Date(r.marked_at as string).toISOString() : "",
  }));
}

/** Tek kişilik işaretleme — tek satır upsert, tüm oturumu yeniden yazmaz. */
export async function markAttendance(
  sessionId: string,
  rec: AttendanceRecord
): Promise<void> {
  await sql`
    INSERT INTO attendance (session_id, assistant_id, status, work_location, marked_at, updated_at)
    VALUES (
      ${sessionId}, ${rec.assistantId}, ${rec.status},
      ${rec.workLocation ?? null},
      ${rec.timestamp ? new Date(rec.timestamp).toISOString() : null},
      now()
    )
    ON CONFLICT (session_id, assistant_id) DO UPDATE SET
      status        = EXCLUDED.status,
      work_location = EXCLUDED.work_location,
      marked_at     = EXCLUDED.marked_at,
      updated_at    = now()
  `;
}

/** Toplu işaretleme — "hepsini yok işaretle" gibi işlemler tek turda biter. */
export async function markAttendanceBulk(
  sessionId: string,
  recs: AttendanceRecord[]
): Promise<number> {
  if (recs.length === 0) return 0;

  const ids = recs.map((r) => r.assistantId);
  const statuses = recs.map((r) => r.status);
  const locations = recs.map((r) => r.workLocation ?? null);
  const stamps = recs.map((r) => (r.timestamp ? new Date(r.timestamp).toISOString() : null));

  await sql`
    INSERT INTO attendance (session_id, assistant_id, status, work_location, marked_at, updated_at)
    SELECT ${sessionId}, t.assistant_id, t.status, t.work_location, t.marked_at, now()
    FROM unnest(
      ${ids}::int[], ${statuses}::text[], ${locations}::text[], ${stamps}::timestamptz[]
    ) AS t(assistant_id, status, work_location, marked_at)
    ON CONFLICT (session_id, assistant_id) DO UPDATE SET
      status        = EXCLUDED.status,
      work_location = EXCLUDED.work_location,
      marked_at     = EXCLUDED.marked_at,
      updated_at    = now()
  `;
  return recs.length;
}

/* ---------- Günlük görev çizelgesi ---------- */

export interface DutyRow {
  date: string; // YYYY-MM-DD
  assistantId: number;
  workLocation: string;
}

/** Bir günün görevlerini döndürür: { asistanId: çalışmaYeri } */
export async function getDutyAssignments(date: string): Promise<Record<number, string>> {
  const rows = await sql`
    SELECT assistant_id, work_location FROM duty_assignments WHERE date = ${date}
  `;
  const sonuc: Record<number, string> = {};
  for (const r of rows) sonuc[r.assistant_id as number] = r.work_location as string;
  return sonuc;
}

/**
 * Yüklenen çizelgeyi kaydeder. Aynı günler yeniden yüklenirse o günlerin
 * eski kayıtları silinip yenisi yazılır — düzeltilmiş dosya yeniden
 * yüklenebilsin diye. Dosyada olmayan günlere dokunulmaz.
 */
export async function replaceDutyAssignments(
  rows: DutyRow[],
  source: string
): Promise<{ days: number; records: number }> {
  const gunler = [...new Set(rows.map((r) => r.date))];
  if (gunler.length === 0) return { days: 0, records: 0 };

  await sql`DELETE FROM duty_assignments WHERE date = ANY(${gunler}::date[])`;

  if (rows.length > 0) {
    await sql`
      INSERT INTO duty_assignments (date, assistant_id, work_location, source)
      SELECT t.date, t.assistant_id, t.work_location, ${source}
      FROM unnest(
        ${rows.map((r) => r.date)}::date[],
        ${rows.map((r) => r.assistantId)}::int[],
        ${rows.map((r) => r.workLocation)}::text[]
      ) AS t(date, assistant_id, work_location)
      ON CONFLICT (date, assistant_id) DO UPDATE SET
        work_location = EXCLUDED.work_location,
        source = EXCLUDED.source
    `;
  }
  return { days: gunler.length, records: rows.length };
}

/** Çizelgesi yüklü günlerin özeti — yönetim ekranında gösterilir. */
export async function listDutyDays(
  limit = 60
): Promise<{ date: string; count: number; source: string | null }[]> {
  const rows = await sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count, MIN(source) AS source
    FROM duty_assignments
    GROUP BY date
    ORDER BY date DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    date: r.date as string,
    count: r.count as number,
    source: (r.source as string) ?? null,
  }));
}

/* ---------- Aylık rotasyonlar ---------- */

export interface RotationRow {
  assistantId: number;
  unit: string;
  workLocation: string;
}

/** Belirli bir günde geçerli rotasyonlar: { asistanId: çalışmaYeri } */
export async function getRotationsForDate(date: string): Promise<Record<number, string>> {
  const rows = await sql`
    SELECT assistant_id, work_location FROM rotations
    WHERE start_date <= ${date} AND end_date >= ${date}
  `;
  const sonuc: Record<number, string> = {};
  for (const r of rows) sonuc[r.assistant_id as number] = r.work_location as string;
  return sonuc;
}

/** Aynı döneme ait eski kayıtları silip yenisini yazar. */
export async function replaceRotations(
  rows: RotationRow[],
  startDate: string,
  endDate: string,
  source: string
): Promise<number> {
  await sql`
    DELETE FROM rotations WHERE start_date = ${startDate} AND end_date = ${endDate}
  `;
  if (rows.length === 0) return 0;

  await sql`
    INSERT INTO rotations (assistant_id, unit, work_location, start_date, end_date, source)
    SELECT t.assistant_id, t.unit, t.work_location, ${startDate}, ${endDate}, ${source}
    FROM unnest(
      ${rows.map((r) => r.assistantId)}::int[],
      ${rows.map((r) => r.unit)}::text[],
      ${rows.map((r) => r.workLocation)}::text[]
    ) AS t(assistant_id, unit, work_location)
    ON CONFLICT (assistant_id, start_date, end_date) DO UPDATE SET
      unit = EXCLUDED.unit, work_location = EXCLUDED.work_location
  `;
  return rows.length;
}

export async function listRotationPeriods(): Promise<
  { startDate: string; endDate: string; count: number; source: string | null }[]
> {
  const rows = await sql`
    SELECT to_char(start_date, 'YYYY-MM-DD') AS s,
           to_char(end_date, 'YYYY-MM-DD')   AS e,
           COUNT(*)::int AS count, MIN(source) AS source
    FROM rotations GROUP BY start_date, end_date ORDER BY start_date DESC
  `;
  return rows.map((r) => ({
    startDate: r.s as string,
    endDate: r.e as string,
    count: r.count as number,
    source: (r.source as string) ?? null,
  }));
}

/* ---------- İsim eşlemeleri (takma adlar) ---------- */

/** alias → assistantId, ya da null ("asistan değil, yok say") */
export async function getNameAliases(): Promise<Map<string, number | null>> {
  const rows = await sql`SELECT alias, assistant_id FROM name_aliases`;
  const m = new Map<string, number | null>();
  for (const r of rows) m.set(r.alias as string, (r.assistant_id as number) ?? null);
  return m;
}

export async function setNameAlias(
  alias: string,
  assistantId: number | null
): Promise<void> {
  await sql`
    INSERT INTO name_aliases (alias, assistant_id) VALUES (${alias}, ${assistantId})
    ON CONFLICT (alias) DO UPDATE SET assistant_id = EXCLUDED.assistant_id
  `;
}

export async function deleteNameAlias(alias: string): Promise<void> {
  await sql`DELETE FROM name_aliases WHERE alias = ${alias}`;
}

export async function listNameAliases(): Promise<
  { alias: string; assistantId: number | null; assistantName: string | null }[]
> {
  const rows = await sql`
    SELECT n.alias, n.assistant_id, a.name
    FROM name_aliases n
    LEFT JOIN assistants a ON a.id = n.assistant_id
    ORDER BY n.alias
  `;
  return rows.map((r) => ({
    alias: r.alias as string,
    assistantId: (r.assistant_id as number) ?? null,
    assistantName: (r.name as string) ?? null,
  }));
}

/* ---------- QR token ---------- */

/**
 * Token'ı tek kullanımlık olarak harcar. Aynı token ikinci kez gelirse
 * INSERT çakışır ve false döner — yarış durumu veritabanı seviyesinde çözülür.
 */
export async function claimToken(sessionId: string, token: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO used_tokens (token, session_id) VALUES (${token}, ${sessionId})
    ON CONFLICT (token, session_id) DO NOTHING
    RETURNING token
  `;
  return rows.length > 0;
}
