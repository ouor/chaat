import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState, Platform, type NativeEventSubscription } from 'react-native';

import { type BlindEvent, parseExtrasEmojis } from '@/client/chzzk/protocol';
import type { ChatMessage } from '@/client/chzzk/types';

import { getDb } from './db';

// Writes run in an exclusive transaction on its own connection, so a concurrent clearLogs /
// pruneLogs can't join (and be rolled back with) an open flush transaction. Web's expo-sqlite has
// no exclusive variant, hence the plain one there (single connection, single flusher).
function inWriteTransaction(db: SQLiteDatabase, task: (conn: SQLiteDatabase) => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') return db.withTransactionAsync(() => task(db));
  return db.withExclusiveTransactionAsync((txn) => task(txn));
}

// Every write (flush, clear, prune) runs one at a time through this chain, so two writers never
// hold the database at once (no SQLITE_BUSY between the exclusive connection and the main one).
let writeChain: Promise<unknown> = Promise.resolve();
function serialWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.catch(() => undefined);
  return run;
}

interface PendingLog {
  channelId: string;
  m: ChatMessage;
}

const buffer: PendingLog[] = [];
const FLUSH_MS = 1000;
// ponytail: if the DB keeps failing, failed batches are re-queued up to this many rows and the
// oldest are dropped past it, so a dead DB can't grow memory until the app is killed (losing all).
// Upgrade path: spill to a file if a persistently failing DB ever shows up in practice.
const MAX_BUFFER = 20000;
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let flushing: Promise<void> | null = null;

function startTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    void flush();
  }, FLUSH_MS);
  // Backgrounded apps get killed without warning; persist the buffer while we still can.
  appStateSub ??= AppState.addEventListener('change', (s) => {
    if (s !== 'active') void flushNow();
  });
}

// Flush without waiting for the timer once this many rows are queued: JS timers can stop (app in
// the background), but writes are promise-driven and still run.
const FLUSH_ROWS = 500;

export function enqueueLog(channelId: string, m: ChatMessage): void {
  buffer.push({ channelId, m });
  startTimer();
  if (buffer.length >= FLUSH_ROWS) void flush();
}

/**
 * A blinded message must not survive in the archive: blank it whether it is still buffered or
 * already written (the UPDATE is queued behind any in-flight flush by the write chain).
 */
export function markLogBlinded(channelId: string, e: BlindEvent): void {
  for (const b of buffer) {
    if (b.channelId === channelId && b.m.msgTime === e.messageTime && b.m.userIdHash === e.userIdHash) {
      b.m = { ...b.m, blinded: true };
    }
  }
  void serialWrite(async () => {
    const db = await getDb();
    await inWriteTransaction(db, async (conn) => {
      await conn.runAsync(
        "UPDATE OR IGNORE messages SET message = '', type = 'blinded', extras_json = NULL WHERE channel_id = ? AND msg_time = ? AND user_id_hash = ?",
        channelId,
        e.messageTime,
        e.userIdHash,
      );
    });
  }).catch(() => undefined);
}

// Single flusher: a slow write must not overlap the next tick's transaction on the same connection.
function flush(): Promise<void> {
  flushing ??= serialWrite(writeBuffered).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function writeBuffered(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const db = await getDb();
    await inWriteTransaction(db, async (conn) => {
      const stmt = await conn.prepareAsync(
        'INSERT OR IGNORE INTO messages (channel_id, chat_channel_id, user_id_hash, nickname, message, type, msg_time, extras_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      );
      try {
        for (const { channelId, m } of batch) {
          await stmt.executeAsync([
            channelId,
            m.chatChannelId,
            m.userIdHash,
            m.nickname,
            m.blinded ? '' : m.message,
            m.blinded ? 'blinded' : m.msgType,
            m.msgTime,
            m.blinded ? null : JSON.stringify(m.extras),
            Date.now(),
          ]);
        }
      } finally {
        await stmt.finalizeAsync();
      }
    });
  } catch (e) {
    console.log('[log] flush FAILED', e);
    buffer.unshift(...batch);
    if (buffer.length > MAX_BUFFER) {
      const dropped = buffer.splice(0, buffer.length - MAX_BUFFER).length;
      console.warn(`[log] buffer over ${MAX_BUFFER}, dropped ${dropped} oldest`);
    }
  }
}

/** Writes the buffer now if anything is waiting (for a caller-driven clock; see chat-keeper). */
export function pumpLogs(): void {
  if (buffer.length > 0) void flush();
}

export async function flushNow(): Promise<void> {
  if (flushing) await flushing;
  await flush();
}

export interface LogRow {
  nickname: string;
  message: string;
  type: string;
  msg_time: number;
  /** Sender's own emojis saved with the message (subscription emojis aren't in the channel pack). */
  emojis?: Record<string, string>;
}

type StoredRow = Omit<LogRow, 'emojis'> & { extras_json: string | null };

// ponytail: the viewer shows only the newest LOG_LIMIT matching rows; older ones are reachable
// by narrowing the search. Upgrade path: keyset pagination on msg_time when scrolling up.
export const LOG_LIMIT = 2000;

/** Newest LOG_LIMIT rows (oldest first), optionally filtered by a message/nickname substring. */
export async function getLogs(channelId: string, query = ''): Promise<LogRow[]> {
  const db = await getDb();
  const q = query.trim().toLowerCase();
  const rows = q
    ? await db.getAllAsync<StoredRow>(
        `SELECT nickname, message, type, msg_time, extras_json FROM messages
         WHERE channel_id = ? AND (instr(lower(message), ?) > 0 OR instr(lower(nickname), ?) > 0)
         ORDER BY msg_time DESC LIMIT ?`,
        channelId,
        q,
        q,
        LOG_LIMIT,
      )
    : await db.getAllAsync<StoredRow>(
        'SELECT nickname, message, type, msg_time, extras_json FROM messages WHERE channel_id = ? ORDER BY msg_time DESC LIMIT ?',
        channelId,
        LOG_LIMIT,
      );
  return rows.reverse().map(({ extras_json, ...row }) => ({ ...row, emojis: parseExtrasEmojis(extras_json) }));
}

export interface ExportRow {
  nickname: string;
  message: string;
  type: string;
  msg_time: number;
  extras_json: string | null;
}

/**
 * Every matching row, oldest first, with no LOG_LIMIT: streamed so a large archive is never held
 * in memory at once. Same filter as getLogs, so an export matches what the search shows.
 */
export async function* eachLog(channelId: string, query = ''): AsyncGenerator<ExportRow> {
  await flushNow();
  const db = await getDb();
  const q = query.trim().toLowerCase();
  const rows = q
    ? db.getEachAsync<ExportRow>(
        `SELECT nickname, message, type, msg_time, extras_json FROM messages
         WHERE channel_id = ? AND (instr(lower(message), ?) > 0 OR instr(lower(nickname), ?) > 0)
         ORDER BY msg_time ASC`,
        channelId,
        q,
        q,
      )
    : db.getEachAsync<ExportRow>(
        'SELECT nickname, message, type, msg_time, extras_json FROM messages WHERE channel_id = ? ORDER BY msg_time ASC',
        channelId,
      );
  yield* rows;
}

export async function countLogs(channelId?: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    channelId ? 'SELECT COUNT(*) AS c FROM messages WHERE channel_id = ?' : 'SELECT COUNT(*) AS c FROM messages',
    ...(channelId ? [channelId] : []),
  );
  return row?.c ?? 0;
}

export function clearLogs(channelId?: string): Promise<void> {
  return serialWrite(async () => {
    const db = await getDb();
    await inWriteTransaction(db, async (conn) => {
      if (channelId) await conn.runAsync('DELETE FROM messages WHERE channel_id = ?', channelId);
      else await conn.runAsync('DELETE FROM messages');
    });
  });
}

export function pruneLogs(days: number): Promise<void> {
  if (!days) return Promise.resolve();
  return serialWrite(async () => {
    const db = await getDb();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    await inWriteTransaction(db, async (conn) => {
      await conn.runAsync('DELETE FROM messages WHERE msg_time < ?', cutoff);
    });
  });
}
