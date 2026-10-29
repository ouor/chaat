// Store-side access to the on-device chat archive. Screens go through here instead of the
// storage layer (AGENTS.md rule 2), so archive policy (retention, what a "saved chat" row is)
// has one home.
import { clearExports, shareFile, writeExportFile } from '@/storage/export-file';
import { clearLogs, eachLog } from '@/storage/log-repo';

import { CSV_BOM, csvHeader, csvLine } from '@/lib/chat-csv';
import { pad2 } from '@/lib/time';

// Plain reads/retention need no store-side policy; screens use them under their storage names.
export { countLogs, getLogs, LOG_LIMIT, pruneLogs, type LogRow } from '@/storage/log-repo';

/** Every saved chat, plus the last exported CSV still in the app cache. */
export async function clearSavedChats(): Promise<void> {
  await clearLogs();
  try {
    clearExports();
  } catch {
    // Cache folder already gone or unavailable (web); nothing left to remove.
  }
}

const CHUNK_ROWS = 500;

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
  const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  const q = query.trim();
  const name = `${channelName} 채팅 ${stamp}${q ? ` (${q})` : ''}`;
  const uri = await writeExportFile(name, 'csv', chunks());
  if (count > 0) await shareFile(uri, 'text/csv', '채팅 내보내기');
  return count;
}
