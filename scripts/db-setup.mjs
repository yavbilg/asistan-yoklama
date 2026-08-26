// Şemayı kurar ve koddaki asistan listesini veritabanına taşır.
// Çalıştırma:  npm run db:setup
//
// Tekrar tekrar çalıştırılabilir: tablolar IF NOT EXISTS, asistanlar ON CONFLICT.

import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("HATA: DATABASE_URL yok. .env.local dosyasına ekleyin.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", prepare: false });

/* 1) Şema */

const schema = await readFile(new URL("../src/lib/schema.sql", import.meta.url), "utf8");

// İfadeleri ayırıp sırayla çalıştırıyoruz.
// Yorumlar ÖNCE siliniyor: içlerinde noktalı virgül geçerse ifadeyi ortadan böler.
const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  await sql.unsafe(stmt);
}
console.log(`Şema kuruldu (${statements.length} ifade).`);

/* 2) Asistanlar — ilk kurulum listesi */

// Liste yalnızca ilk kurulum içindir; sonrasında asistanlar /asistanlar
// ekranından yönetilir ve bu dosya artık okunmaz (mevcut kayıtlar korunur).
const people = JSON.parse(
  await readFile(new URL("./seed-assistants.json", import.meta.url), "utf8")
);

if (people.length === 0) {
  console.log("Tohum listesi boş, aktarım atlandı.");
} else {
  // id'ler korunuyor: geçmiş yoklama kayıtları bu id'lere bağlı.
  await sql.unsafe(
    `INSERT INTO assistants (id, name, end_date)
     SELECT * FROM unnest($1::int[], $2::text[], $3::text[])
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, end_date = EXCLUDED.end_date`,
    [people.map((p) => p.id), people.map((p) => p.name), people.map((p) => p.endDate)]
  );

  // SERIAL sayacını en büyük id'nin üstüne al, yoksa yeni ekleme çakışır.
  await sql.unsafe(
    `SELECT setval('assistants_id_seq', (SELECT COALESCE(MAX(id), 1) FROM assistants))`
  );

  console.log(`${people.length} asistan aktarıldı.`);
}

const [{ count }] = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM assistants`);
console.log(`Veritabanındaki asistan sayısı: ${count}`);
console.log("Hazır.");

await sql.end();
