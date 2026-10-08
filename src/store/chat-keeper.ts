// Keeps the open chat room receiving after the app is left (Android foreground service), and
// mirrors the newest chats into its notification like a messenger conversation.
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { stripEmoji } from '@/client/chzzk/emoji';
import type { ChatMessage } from '@/client/chzzk/types';
import { ANONYMOUS_DONOR } from '@/constants/chat-text';

import {
  chatKeeperHeartbeat,
  isChatKeeperAvailable,
  onChatKeeperStopped,
  onChatKeeperTick,
  startChatKeeper,
  stopChatKeeper,
  updateChatKeeper,
  type KeeperMessage,
} from '../../modules/chat-keeper';

export { isChatKeeperAvailable };

// Notification shows the newest few; Android rate-limits rapid updates, so they're coalesced into
// one update per native tick (1s).
const SHOWN = 5;
// A reconnect replays the last 50 chats; don't show the ones already shown as new again.
const SEEN = 200;
// Renew the native wake lock (30s lease) every this many ticks; each renewal is a binder call.
const HEARTBEAT_TICKS = 10;

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
  /**
   * Runs `fn` every second while keeping. JS timers stop once the app is in the background, so
   * anything that must keep running there (socket ping/reconnect, log writes) hangs off this.
   */
  onTick: (fn: () => void) => void;
  stop: () => void;
}

/**
 * Why a keeper stopped without its owner asking:
 * - 'ended': the service ended ("그만 받기", task swiped away, system); don't restart this visit.
 * - 'handover': another room took the one service over; may start again when it's free.
 */
export type KeeperStopReason = 'ended' | 'handover';

// One service, so one keeper: opening another room hands the service over to it.
let current: { stop: () => void; onStopped: (reason: KeeperStopReason) => void } | null = null;

/**
 * Starts keeping the room alive. Must run while the app is in the foreground (Android forbids
 * starting the service from the background). `onStopped` fires when it stops on its own.
 */
export function startKeeper(title: string, onStopped: (reason: KeeperStopReason) => void): ChatKeeper | null {
  if (!isChatKeeperAvailable) return null;
  if (current) {
    const prev = current;
    prev.stop();
    prev.onStopped('handover');
  }

  let lines: KeeperMessage[] = [];
  let shownTitle = title;
  let dirty = false;
  let stopped = false;
  const tickListeners: (() => void)[] = [];

  const seen = new Set<string>();
  let ticks = 0;
  const tick = onChatKeeperTick(() => {
    if (stopped) return;
    if (ticks++ % HEARTBEAT_TICKS === 0) chatKeeperHeartbeat();
    // While the app is on screen nobody reads the notification; skip the rebuild (it is caught up
    // on the first tick after the app is left).
    if (dirty && AppState.currentState !== 'active') {
      dirty = false;
      updateChatKeeper(shownTitle, lines);
    }
    for (const fn of tickListeners) fn();
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    tickListeners.length = 0;
    sub?.remove();
    tick?.remove();
    stopChatKeeper();
    if (current === handle) current = null;
  };
  const sub = onChatKeeperStopped(() => {
    if (stopped) return;
    stop();
    onStopped('ended');
  });
  const handle = { stop, onStopped };
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
      const key = `${m.msgTime}:${m.userIdHash}:${m.message}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (seen.size > SEEN) seen.delete(seen.values().next().value as string);
      lines = [...lines, line].slice(-SHOWN);
      dirty = true;
    },
    setTitle: (t) => {
      if (t === shownTitle || stopped) return;
      shownTitle = t;
      dirty = true;
    },
    onTick: (fn) => {
      if (!stopped) tickListeners.push(fn);
    },
    stop,
  };
}
