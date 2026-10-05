// Store-side access to the on-device chat archive. Screens go through here instead of the
// storage layer (AGENTS.md rule 2), so archive policy (retention, what a "saved chat" row is)
// has one home.
import { clearLogs, countLogs, getLogs, LOG_LIMIT, pruneLogs, type LogRow } from '@/storage/log-repo';

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
