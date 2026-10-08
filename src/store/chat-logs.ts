// Store-side access to the on-device chat archive. Screens go through here instead of the
// storage layer (AGENTS.md rule 2), so archive policy (retention, what a "saved chat" row is)
// has one home.
import { shareFile, writeExportFile } from '@/storage/export-file';
import { clearLogs, countLogs, eachLog, getLogs, LOG_LIMIT, pruneLogs, type LogRow } from '@/storage/log-repo';

import { CSV_BOM, csvHeader, csvLine } from './chat-csv';

export { LOG_LIMIT, type LogRow };

/** Newest saved rows for a channel (oldest first), optionally filtered by text or nickname. */
export function loadChatLogs(channelId: string, query = ''): Promise<LogRow[]> {
  return getLogs(channelId, query);
}

export function countSavedChats(): Promise<number> {
  return countLogs();
}

export function clearSavedChats(): Promise<void> {
  return clearLogs();
}

/** Drops rows older than the retention window (0 = keep forever). */
export function applyRetention(days: number): Promise<void> {
  return pruneLogs(days);
}

const CHUNK_ROWS = 500;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Writes every saved chat matching `query` (the whole archive, not just the LOG_LIMIT shown) to
 * a CSV file and opens the share sheet. Resolves to the number of chats exported; 0 shares nothing.
 */
export async function exportChatLogs(channelId: string, channelName: string, query = ''): Promise<number> {
  let count = 0;
  async function* chunks(): AsyncGenerator<string> {
    yield CSV_BOM + csvHeader();
    let buf = '';
    let n = 0;
    for await (const row of eachLog(channelId, query)) {
      buf += csvLine(row);
      count += 1;
      if (++n === CHUNK_ROWS) {
        yield buf;
        buf = '';
        n = 0;
      }
    }
    if (buf) yield buf;
  }

  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const q = query.trim();
  const name = `${channelName} 채팅 ${stamp}${q ? ` (${q})` : ''}`;
  const uri = await writeExportFile(name, 'csv', chunks());
  if (count > 0) await shareFile(uri, 'text/csv', '채팅 내보내기');
  return count;
}
