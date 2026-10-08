import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
// 2: blinds remembers which messages were hidden. A blanked row's dedup key (message '') no
//    longer matches the original text, so a later copy (reconnect replay, a re-queued batch)
//    would be stored again in full; inserts now check this table first.
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
  if (version < 2) {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS blinds (
  channel_id TEXT NOT NULL,
  msg_time INTEGER NOT NULL,
  user_id_hash TEXT NOT NULL,
  PRIMARY KEY (channel_id, msg_time, user_id_hash)
) WITHOUT ROWID;
INSERT OR IGNORE INTO blinds SELECT channel_id, msg_time, user_id_hash FROM messages
  WHERE type = 'blinded' AND msg_time IS NOT NULL AND user_id_hash IS NOT NULL;
PRAGMA user_version = 2;
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

/**
 * Connection used only by the serialized writer (log-repo's write chain), opened once. Its own
 * connection keeps reads on the main one from joining (and being rolled back with) a write
 * transaction; reusing it avoids withExclusiveTransactionAsync's open/close of a fresh connection
 * on every 1s flush. Web's expo-sqlite has one connection only.
 */
export function getWriteDb(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') return getDb();
  if (!writeDbPromise) {
    writeDbPromise = getDb()
      .then(() => SQLite.openDatabaseAsync('chaat.db', { useNewConnection: true }))
      .catch((e: unknown) => {
        writeDbPromise = null;
        throw e;
      });
  }
  return writeDbPromise;
}
