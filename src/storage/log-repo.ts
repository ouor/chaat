import type { ChatMessage } from '@/client/chzzk/types';

import { getDb } from './db';

interface PendingLog {
  channelId: string;
  m: ChatMessage;
}

const buffer: PendingLog[] = [];
const FLUSH_MS = 1000;
let timer: ReturnType<typeof setInterval> | null = null;

function startTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    void flush();
  }, FLUSH_MS);
}

export function enqueueLog(channelId: string, m: ChatMessage): void {
  buffer.push({ channelId, m });
  startTimer();
}

export function stopLogging(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const db = await getDb();
    // ponytail: withTransactionAsync instead of withExclusiveTransactionAsync so the write path
    // also works on web (where the exclusive variant throws). Single flusher, so exclusivity adds
    // nothing here. Upgrade back if a second writer appears.
    await db.withTransactionAsync(async () => {
      const stmt = await db.prepareAsync(
        'INSERT OR IGNORE INTO messages (channel_id, chat_channel_id, user_id_hash, nickname, message, type, msg_time, extras_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      );
      try {
        for (const { channelId, m } of batch) {
          await stmt.executeAsync([
            channelId,
            m.chatChannelId,
            m.userIdHash,
            m.nickname,
            m.message,
            m.msgType,
            m.msgTime,
            JSON.stringify(m.extras),
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
  }
}

export async function flushNow(): Promise<void> {
  await flush();
}

export interface LogRow {
  nickname: string;
  message: string;
  type: string;
  msg_time: number;
}

export async function getLogs(channelId: string): Promise<LogRow[]> {
  const db = await getDb();
  return db.getAllAsync<LogRow>(
    'SELECT nickname, message, type, msg_time FROM messages WHERE channel_id = ? ORDER BY msg_time ASC',
    channelId,
  );
}

export async function countLogs(channelId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM messages WHERE channel_id = ?',
    channelId,
  );
  return row?.c ?? 0;
}
