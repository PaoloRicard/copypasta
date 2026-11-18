import { neon } from '@neondatabase/serverless';

let sql;
let ready;

function getDb() {
  if (!sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL não configurada.');
    sql = neon(url);
  }
  return sql;
}

// Garante que a tabela existe (cria sozinha na primeira chamada)
export async function ensureTable() {
  const db = getDb();
  if (!ready) {
    ready = db`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        copies INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `.catch((err) => { ready = null; throw err; });
  }
  await ready;
  return db;
}
