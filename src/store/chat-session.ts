import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getAccessToken, getLiveStatus, isChannelId } from '@/client/chzzk/rest';
import { ChatSocket, type ConnState } from '@/client/chzzk/socket';
import type { ChatMessage } from '@/client/chzzk/types';
import { startKeeper, type ChatKeeper } from '@/store/chat-keeper';
import { useEmojiMap } from '@/store/emoji-map';
import { useSettings } from '@/store/settings';
import { enqueueLog, markLogBlinded, pumpLogs } from '@/storage/log-repo';

const MAX_MESSAGES = 500;
// While the user is scrolled up reading, trimming the oldest rows would delete what they're
// looking at; let the list grow to this hard cap instead and trim back once they return.
const MAX_WHILE_READING = 2000;
// Burst chat arrives as many frames per second; commit them to state at most this often.
const COMMIT_MS = 100;
// Reconnect re-requests the last 50 recent chats; they can only overlap the tail of the list.
const DEDUP_WINDOW = 100;

function isDuplicate(prev: ChatMessage[], m: ChatMessage): boolean {
  for (let i = prev.length - 1; i >= Math.max(0, prev.length - DEDUP_WINDOW); i--) {
    const p = prev[i];
    if (p.msgTime === m.msgTime && p.userIdHash === m.userIdHash && p.message === m.message) return true;
  }
  return false;
}

/** Socket state, or 'unavailable' when the channel has no chat room to connect to. */
export type SessionConnState = ConnState | 'unavailable';

export interface ChatSession {
  connState: SessionConnState;
  liveStatus: 'OPEN' | 'CLOSE' | null;
  chatChannelId: string | null;
  messages: ChatMessage[];
  notice: string | null;
  streamingChannelId: string | null;
  canModerate: boolean;
  /** 'unavailable' because the stream is age-restricted (sign in / age verification needed). */
  adultOnly: boolean;
  emojiMap: Record<string, string>;
  /** False when not connected; the caller should keep the draft. */
  sendChat: (text: string) => boolean;
  retry: () => void;
  /** True while the user is scrolled away from the newest messages. */
  setReading: (reading: boolean) => void;
}

export function useChatSession(
  channelId: string,
  auth: { cookie?: string; uid?: string } = {},
  /** Channel name, for the background notification. */
  title = '',
): ChatSession {
  const [connState, setConnState] = useState<SessionConnState>('idle');
  const [liveStatus, setLiveStatus] = useState<'OPEN' | 'CLOSE' | null>(null);
  const [chatChannelId, setChatChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [adultOnly, setAdultOnly] = useState(false);
  const emojiMap = useEmojiMap(channelId, auth.cookie);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<ChatSocket | null>(null);
  const readingRef = useRef(false);
  // Which channel the current messages belong to. Reconnecting the same channel (sign-in resolving
  // after the room opened, retry) keeps what is on screen; the recent-chat replay is deduped.
  const shownChannelRef = useRef<string | null>(null);
  const { backgroundCollect } = useSettings();
  // Background collection: while it runs, the socket keeps reconnecting even when the app is
  // not in front. Stopped from the notification = off until the room is opened again.
  const keeperRef = useRef<ChatKeeper | null>(null);
  const keeperStoppedRef = useRef(false);
  const titleRef = useRef(title);
  // Does by hand what this room's timers would (UI commit, socket ping/reconnect); the keeper's
  // tick calls it because JS timers stop in the background.
  const pumpRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: ChatSocket | null = null;
    let pending: ChatMessage[] = [];
    let commitTimer: ReturnType<typeof setTimeout> | null = null;

    const commit = () => {
      commitTimer = null;
      const batch = pending;
      pending = [];
      setMessages((prev) => {
        const next = [...prev];
        for (const m of batch) if (!isDuplicate(next, m)) next.push(m);
        if (next.length === prev.length) return prev;
        const cap = readingRef.current ? MAX_WHILE_READING : MAX_MESSAGES;
        return next.length > cap ? next.slice(-cap) : next;
      });
    };

    (async () => {
      if (shownChannelRef.current !== channelId) {
        shownChannelRef.current = channelId;
        setMessages([]);
        setLiveStatus(null);
        setNotice(null);
      }
      // Route params come from deep links (chaat://chat/<anything>): no request, no keeper.
      if (!isChannelId(channelId)) {
        setConnState('unavailable');
        return;
      }
      setConnState('connecting');
      try {
        const status = await getLiveStatus(channelId, auth.cookie);
        if (cancelled) return;
        setLiveStatus(status.status);
        const cid = status.chatChannelId;
        setChatChannelId(cid);
        setAdultOnly(!cid && status.adult);
        if (!cid) {
          setConnState('unavailable');
          return;
        }

        socket = new ChatSocket({
          chatChannelId: cid,
          streamingChannelId: channelId,
          getAccessToken: () => getAccessToken(cid, auth.cookie),
          uid: auth.uid,
          onMessage: (m) => {
            if (auth.uid && m.userIdHash === auth.uid && (m.role === 'streamer' || m.role === 'manager')) {
              setCanModerate(true);
            }
            enqueueLog(channelId, m);
            keeperRef.current?.push(m);
            pending.push(m);
            commitTimer ??= setTimeout(commit, COMMIT_MS);
          },
          onBlind: (e) => {
            const hit = (m: ChatMessage) => m.msgTime === e.messageTime && m.userIdHash === e.userIdHash;
            pending = pending.map((m) => (hit(m) ? { ...m, blinded: true } : m));
            setMessages((prev) => (prev.some(hit) ? prev.map((m) => (hit(m) ? { ...m, blinded: true } : m)) : prev));
            markLogBlinded(channelId, e);
          },
          onNotice: (text) => setNotice(text),
          onStateChange: setConnState,
        });
        socketRef.current = socket;
        pumpRef.current = () => {
          if (AppState.currentState === 'active') {
            if (pending.length > 0) {
              if (commitTimer) clearTimeout(commitTimer);
              commit();
            }
          } else if (pending.length > MAX_MESSAGES) {
            // Not on screen: don't re-render a hidden list every second; keep only what the list
            // would show and let the commit timer apply it once the app is back.
            pending = pending.slice(-MAX_MESSAGES);
          }
          socket?.pump();
        };
        socket.connect();
        if (AppState.currentState !== 'active' && !keeperRef.current) socket.setForeground(false);
      } catch {
        if (!cancelled) setConnState('offline');
      }
    })();

    return () => {
      cancelled = true;
      if (commitTimer) clearTimeout(commitTimer);
      socket?.close();
      socketRef.current = null;
      pumpRef.current = null;
    };
  }, [channelId, auth.cookie, auth.uid, attempt]);

  useEffect(() => {
    titleRef.current = title;
    keeperRef.current?.setTitle(title);
  }, [title]);

  // Runs while this room is open and has a chat room. The service must start while the app is in
  // front (Android rule), so a room opened in the background starts it on the next return.
  useEffect(() => {
    keeperStoppedRef.current = false;
    if (!chatChannelId || !backgroundCollect) return;
    const start = () => {
      if (keeperRef.current || keeperStoppedRef.current) return;
      keeperRef.current = startKeeper(titleRef.current, (reason) => {
        keeperRef.current = null;
        // Ended (button, task swipe, system): stay off until the room is opened again. Handed to
        // another room: start again on the next return to the app.
        if (reason === 'ended') keeperStoppedRef.current = true;
        socketRef.current?.setForeground(AppState.currentState === 'active');
      });
      keeperRef.current?.onTick(() => {
        pumpRef.current?.();
        pumpLogs();
      });
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') start();
    });
    return () => {
      sub.remove();
      keeperRef.current?.stop();
      keeperRef.current = null;
      socketRef.current?.setForeground(AppState.currentState === 'active');
    };
  }, [channelId, chatChannelId, backgroundCollect]);

  // Doze and network switches leave half-open sockets; let the socket re-check on return to
  // foreground. While collecting in the background the socket behaves as if in front.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) =>
      socketRef.current?.setForeground(s === 'active' || keeperRef.current != null),
    );
    return () => sub.remove();
  }, []);

  const sendChat = useCallback((text: string): boolean => {
    return socketRef.current?.sendChat(text) ?? false;
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const setReading = useCallback((reading: boolean) => {
    readingRef.current = reading;
    if (!reading) setMessages((prev) => (prev.length > MAX_MESSAGES ? prev.slice(-MAX_MESSAGES) : prev));
  }, []);

  return {
    connState,
    liveStatus,
    chatChannelId,
    messages,
    notice,
    // The room's own channel. Never taken from a chat's extras: senders control those, and this id
    // goes into authenticated blind/notice requests.
    streamingChannelId: chatChannelId ? channelId : null,
    canModerate,
    adultOnly,
    emojiMap,
    sendChat,
    retry,
    setReading,
  };
}
