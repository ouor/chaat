import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getAccessToken, getLiveStatus } from '@/client/chzzk/rest';
import { ChatSocket, type ConnState } from '@/client/chzzk/socket';
import type { ChatMessage } from '@/client/chzzk/types';
import { useEmojiMap } from '@/store/emoji-map';
import { enqueueLog } from '@/storage/log-repo';

const MAX_MESSAGES = 500;
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
  emojiMap: Record<string, string>;
  /** False when not connected; the caller should keep the draft. */
  sendChat: (text: string) => boolean;
  retry: () => void;
}

export function useChatSession(
  channelId: string,
  auth: { cookie?: string; uid?: string } = {},
): ChatSession {
  const [connState, setConnState] = useState<SessionConnState>('idle');
  const [liveStatus, setLiveStatus] = useState<'OPEN' | 'CLOSE' | null>(null);
  const [chatChannelId, setChatChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [streamingChannelId, setStreamingChannelId] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const emojiMap = useEmojiMap(channelId, auth.cookie);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<ChatSocket | null>(null);

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
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    };

    (async () => {
      setMessages([]);
      setConnState('connecting');
      setLiveStatus(null);
      setNotice(null);
      try {
        const status = await getLiveStatus(channelId);
        if (cancelled) return;
        setLiveStatus(status.status);
        const cid = status.chatChannelId;
        setChatChannelId(cid);
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
            if (typeof m.extras.streamingChannelId === 'string') {
              setStreamingChannelId(m.extras.streamingChannelId);
            }
            if (auth.uid && m.userIdHash === auth.uid && (m.role === 'streamer' || m.role === 'manager')) {
              setCanModerate(true);
            }
            enqueueLog(channelId, m);
            pending.push(m);
            commitTimer ??= setTimeout(commit, COMMIT_MS);
          },
          onNotice: (text) => setNotice(text),
          onStateChange: setConnState,
        });
        socketRef.current = socket;
        socket.connect();
        if (AppState.currentState !== 'active') socket.setForeground(false);
      } catch {
        if (!cancelled) setConnState('offline');
      }
    })();

    return () => {
      cancelled = true;
      if (commitTimer) clearTimeout(commitTimer);
      socket?.close();
      socketRef.current = null;
    };
  }, [channelId, auth.cookie, auth.uid, attempt]);

  // Doze and network switches leave half-open sockets; let the socket re-check on return to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => socketRef.current?.setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  const sendChat = useCallback((text: string): boolean => {
    return socketRef.current?.sendChat(text) ?? false;
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return {
    connState,
    liveStatus,
    chatChannelId,
    messages,
    notice,
    streamingChannelId,
    canModerate,
    emojiMap,
    sendChat,
    retry,
  };
}
