import { useCallback, useEffect, useRef, useState } from 'react';

import { getAccessToken, getEmojiPacks, getLiveStatus } from '@/client/chzzk/rest';
import { ChatSocket, type ConnState } from '@/client/chzzk/socket';
import type { ChatMessage } from '@/client/chzzk/types';
import { enqueueLog } from '@/storage/log-repo';

const MAX_MESSAGES = 500;

export interface ChatSession {
  connState: ConnState;
  liveStatus: 'OPEN' | 'CLOSE' | null;
  chatChannelId: string | null;
  messages: ChatMessage[];
  notice: string | null;
  streamingChannelId: string | null;
  canModerate: boolean;
  emojiMap: Record<string, string>;
  sendChat: (text: string) => void;
  retry: () => void;
}

export function useChatSession(
  channelId: string,
  auth: { cookie?: string; uid?: string } = {},
): ChatSession {
  const [connState, setConnState] = useState<ConnState>('idle');
  const [liveStatus, setLiveStatus] = useState<'OPEN' | 'CLOSE' | null>(null);
  const [chatChannelId, setChatChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [streamingChannelId, setStreamingChannelId] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [emojiMap, setEmojiMap] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEmojiPacks(channelId, auth.cookie)
      .then((emojis) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const e of emojis) map[e.emojiId] = e.imageUrl;
        setEmojiMap(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [channelId, auth.cookie]);

  useEffect(() => {
    let cancelled = false;
    let socket: ChatSocket | null = null;

    (async () => {
      setMessages([]);
      setConnState('connecting');
      setLiveStatus(null);
      setNotice(null);
      try {
        const status = await getLiveStatus(channelId);
        if (cancelled) return;
        setLiveStatus(status.status);
        setChatChannelId(status.chatChannelId);

        const token = await getAccessToken(status.chatChannelId, auth.cookie);
        if (cancelled) return;

        socket = new ChatSocket({
          chatChannelId: status.chatChannelId,
          accessToken: token.accessToken,
          uid: auth.uid,
          onMessage: (m) => {
            if (typeof m.extras.streamingChannelId === 'string') {
              setStreamingChannelId(m.extras.streamingChannelId);
            }
            if (auth.uid && m.userIdHash === auth.uid && (m.role === 'streamer' || m.role === 'manager')) {
              setCanModerate(true);
            }
            enqueueLog(channelId, m);
            setMessages((prev) =>
              prev.length >= MAX_MESSAGES ? [...prev.slice(-(MAX_MESSAGES - 1)), m] : [...prev, m],
            );
          },
          onNotice: (text) => setNotice(text),
          onStateChange: setConnState,
        });
        socketRef.current = socket;
        socket.connect();
      } catch {
        if (!cancelled) setConnState('offline');
      }
    })();

    return () => {
      cancelled = true;
      socket?.close();
      socketRef.current = null;
    };
  }, [channelId, auth.cookie, auth.uid, attempt]);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.sendChat(text);
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { connState, liveStatus, chatChannelId, messages, notice, streamingChannelId, canModerate, emojiMap, sendChat, retry };
}
