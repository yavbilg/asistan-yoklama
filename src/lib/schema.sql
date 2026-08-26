-- Asistan Yoklama — veritabanı şeması (PostgreSQL)
-- Kurulum: DATABASE_URL tanımlıyken `npm run db:setup`

CREATE TABLE IF NOT EXISTS assistants (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  end_date    TEXT,                    -- kıdem/bitiş tarihi, GG.AA.YY
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  lesson_name TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aynı ders/tarih/saat için ikinci bir oturum açılamaz.
-- Geçmiş listesindeki mükerrer kayıtların sebebi buydu.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_unique_slot
  ON sessions (lesson_name, date, start_time);

CREATE INDEX IF NOT EXISTS sessions_date_idx ON sessions (date DESC);

-- Kişi başına TEK satır. Eski tasarımda tüm yoklama tek bir hücrede JSON
-- olarak duruyordu; iki kişi aynı anda giriş yapınca biri diğerini eziyordu.
CREATE TABLE IF NOT EXISTS attendance (
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  assistant_id  INTEGER NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('var', 'yok', 'muaf')),
  work_location TEXT,
  marked_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, assistant_id)
);

CREATE INDEX IF NOT EXISTS attendance_assistant_idx ON attendance (assistant_id);

-- QR token'ları tek kullanımlık: aynı token ikinci kez kullanılamaz.
-- Günlük görev çizelgesi. Aylık Excel dosyası yüklendiğinde doldurulur;
-- oturum açılırken buradan okunur, dışarıya çağrı yapılmaz.
CREATE TABLE IF NOT EXISTS duty_assignments (
  date          DATE NOT NULL,
  assistant_id  INTEGER NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  work_location TEXT NOT NULL,
  source        TEXT,           -- hangi dosya/sayfadan geldiği
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, assistant_id)
);

CREATE INDEX IF NOT EXISTS duty_date_idx ON duty_assignments (date);

-- Aylık dış rotasyonlar (Nöroloji, Çoc. Psikiyatrisi, TRSM, izin).
-- Günlük çizelgeden ayrı tutulur: bu kayıtlar bir tarih ARALIĞINI kapsar,
-- aynı tabloya yazılsalardı ayın her gününü doldurup günlük veriyi ezerlerdi.
CREATE TABLE IF NOT EXISTS rotations (
  id            SERIAL PRIMARY KEY,
  assistant_id  INTEGER NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  unit          TEXT NOT NULL,          -- dosyadaki birim adı, örn "Çoc. Psk."
  work_location TEXT NOT NULL,          -- karşılığı, örn "Çoc. Psikiyatrisi"
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  source        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rotations_period_idx ON rotations (start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS rotations_unique
  ON rotations (assistant_id, start_date, end_date);

-- Çizelgede geçen ama otomatik çözülemeyen yazımlar. Kullanıcı bir kez
-- eşler, sonraki yüklemelerde otomatik uygulanır.
-- assistant_id NULL ise "bu kişi asistan değil, yok say" demektir.
CREATE TABLE IF NOT EXISTS name_aliases (
  alias        TEXT PRIMARY KEY,          -- normalleştirilmiş yazım, örn "BETUL H"
  assistant_id INTEGER REFERENCES assistants(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS used_tokens (
  token       TEXT NOT NULL,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (token, session_id)
);
