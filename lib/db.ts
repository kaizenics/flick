import { createClient, type Client } from "@libsql/client";

let _db: Client | null = null;
let _ensured = false;

export function db(): Client {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");
    _db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return _db;
}

export async function ensureSchema() {
  if (_ensured) return;
  _ensured = true;
  await db().execute(`
    CREATE TABLE IF NOT EXISTS workflow (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);
  await db().execute(
    `CREATE INDEX IF NOT EXISTS workflow_user_idx ON workflow(userId, updatedAt DESC)`,
  );
}
