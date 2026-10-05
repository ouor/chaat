import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function init(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('chaat.db');
  await db.execAsync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  chat_channel_id TEXT,
  user_id_hash TEXT,
  nickname TEXT,
  message TEXT,
  type TEXT,
  msg_time INTEGER,
  extras_json TEXT,
  created_at INTEGER
);
`);
  await migrate(db);
  return db;
}

// Schema versions, tracked in PRAGMA user_version.
// 1: the dedup key includes the sender. (channel, time, text) alone made INSERT OR IGNORE drop a
//    real message whenever two users sent the same text in the same millisecond ("ㅋㅋㅋ" waves).
//    The new key is strictly wider, so building it over existing rows cannot conflict.
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(`
DROP INDEX IF EXISTS idx_messages_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_dedup_v1 ON messages (channel_id, msg_time, user_id_hash, message);
PRAGMA user_version = 1;
`);
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    // A failed open (disk full at launch, ...) must not be cached for the whole run, or every
    // later flush fails and the log buffer fills up; the next call retries.
    dbPromise = init().catch((e: unknown) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
