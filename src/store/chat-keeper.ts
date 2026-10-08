// Keeps the open chat room receiving after the app is left (Android foreground service), and
// mirrors the newest chats into its notification like a messenger conversation.
import { PermissionsAndroid, Platform } from 'react-native';

import { stripEmoji } from '@/client/chzzk/emoji';
import type { ChatMessage } from '@/client/chzzk/types';
import { ANONYMOUS_DONOR } from '@/constants/chat-text';

import {
  isChatKeeperAvailable,
  onChatKeeperStopRequested,
  startChatKeeper,
  stopChatKeeper,
  updateChatKeeper,
  type KeeperMessage,
} from '../../modules/chat-keeper';

export { isChatKeeperAvailable };

// Notification shows the newest few; Android rate-limits rapid updates, so they're coalesced.
const SHOWN = 8;
const UPDATE_MS = 1000;

/** A chat as one notification line, or null for what shouldn't be shown there. */
export function keeperLine(m: ChatMessage): KeeperMessage | null {
  if (m.blinded || m.msgType === 'system') return null;
  const { text, hadEmoji } = stripEmoji(m.message);
  const body = text || (hadEmoji ? '(이모티콘)' : '');
  if (m.msgType === 'donation') {
    const amount = m.donationAmount ? ` ₩${m.donationAmount.toLocaleString()}` : '';
    return { nickname: m.nickname || ANONYMOUS_DONOR, text: `후원${amount}${body ? ` · ${body}` : ''}`, time: m.msgTime };
  }
  if (!body) return null;
  return { nickname: m.nickname || '익명', text: body, time: m.msgTime };
}

/**
 * Android 13+ asks before an app may post notifications. Collection works without it (the
 * service runs either way); only the chat notification stays hidden.
 */
async function askNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  try {
    if (!(await PermissionsAndroid.check(perm))) await PermissionsAndroid.request(perm);
  } catch {
    // No dialog possible (activity gone); the notification just stays hidden.
  }
}

export interface ChatKeeper {
  push: (m: ChatMessage) => void;
  setTitle: (title: string) => void;
  stop: () => void;
}

// One service, so one keeper: opening another room hands the service over to it.
let current: { stop: () => void } | null = null;

/**
 * Starts keeping the room alive. Must run while the app is in the foreground (Android forbids
 * starting the service from the background). `onStopped` fires when the user taps "그만 받기".
 */
export function startKeeper(title: string, onStopped: () => void): ChatKeeper | null {
  if (!isChatKeeperAvailable) return null;
  current?.stop();

  let lines: KeeperMessage[] = [];
  let shownTitle = title;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const flush = () => {
    timer = null;
    if (!stopped) updateChatKeeper(shownTitle, lines);
  };
  const schedule = () => {
    timer ??= setTimeout(flush, UPDATE_MS);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    sub?.remove();
    stopChatKeeper();
    if (current === handle) current = null;
  };
  const sub = onChatKeeperStopRequested(() => {
    if (stopped) return;
    stop();
    onStopped();
  });
  const handle = { stop };
  current = handle;

  void askNotificationPermission();
  try {
    startChatKeeper(title);
  } catch {
    // Start refused (e.g. the app already went to the background); run without it.
    stop();
    return null;
  }

  return {
    push: (m) => {
      const line = keeperLine(m);
      if (!line || stopped) return;
      lines = [...lines, line].slice(-SHOWN);
      schedule();
    },
    setTitle: (t) => {
      if (t === shownTitle || stopped) return;
      shownTitle = t;
      schedule();
    },
    stop,
  };
}
