import { useCallback, useEffect, useRef, useState } from 'react';

import { getAccessToken, getLiveStatus } from '@/client/chzzk/rest';
import { ChatSocket, type ConnState } from '@/client/chzzk/socket';
import type { ChatMessage } from '@/client/chzzk/types';
import { enqueueLog } from '@/storage/log-repo';

const MAX_MESSAGES = 500;

export interface ChatSession {
  connState: ConnState;
  liveStatus: 'OPEN' | 'CLOSE' | null;
  messages: ChatMessage[];
  sendChat: (text: string) => void;
  retry: () => void;
}

export function useChatSession(
  channelId: string,
  auth: { cookie?: string; uid?: string } = {},
): ChatSession {
  const [connState, setConnState] = useState<ConnState>('idle');
  const [liveStatus, setLiveStatus] = useState<'OPEN' | 'CLOSE' | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: ChatSocket | null = null;

    (async () => {
      setMessages([]);
      setConnState('connecting');
      setLiveStatus(null);
      try {
        const status = await getLiveStatus(channelId);
        if (cancelled) return;
        setLiveStatus(status.status);

        const token = await getAccessToken(status.chatChannelId, auth.cookie);
        if (cancelled) return;

        socket = new ChatSocket({
          chatChannelId: status.chatChannelId,
          accessToken: token.accessToken,
          uid: auth.uid,
          onMessage: (m) => {
            enqueueLog(channelId, m);
            setMessages((prev) =>
              prev.length >= MAX_MESSAGES ? [...prev.slice(-(MAX_MESSAGES - 1)), m] : [...prev, m],
            );
          },
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

  return { connState, liveStatus, messages, sendChat, retry };
}
