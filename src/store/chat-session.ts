import { useCallback, useEffect, useRef, useState } from 'react';

import { getAccessToken, getEmojiPacks, getLiveStatus, getProfileCard } from '@/client/chzzk/rest';
import { ChatSocket, type ConnState } from '@/client/chzzk/socket';
import type { ChatMessage } from '@/client/chzzk/types';
import { enqueueLog } from '@/storage/log-repo';

const MAX_MESSAGES = 500;
// Reconnect re-requests the last 50 recent chats; they can only overlap the tail of the list.
const DEDUP_WINDOW = 100;

function isDuplicate(prev: ChatMessage[], m: ChatMessage): boolean {
  for (let i = prev.length - 1; i >= Math.max(0, prev.length - DEDUP_WINDOW); i--) {
    const p = prev[i];
    if (p.msgTime === m.msgTime && p.userIdHash === m.userIdHash && p.message === m.message) return true;
  }
  return false;
}

export interface ChatSession {
  connState: ConnState;
  liveStatus: 'OPEN' | 'CLOSE' | null;
  chatChannelId: string | null;
  messages: ChatMessage[];
  notice: string | null;
  streamingChannelId: string | null;
  canModerate: boolean;
  emojiMap: Record<string, string>;
  profileImages: Record<string, string>;
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
  const [profileImages, setProfileImages] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<ChatSocket | null>(null);
  const profileImageCache = useRef<Record<string, string>>({});
  const pendingProfiles = useRef<Set<string>>(new Set());

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

        socket = new ChatSocket({
          chatChannelId: status.chatChannelId,
          getAccessToken: () => getAccessToken(status.chatChannelId, auth.cookie).then((t) => t.accessToken),
          uid: auth.uid,
          onMessage: (m) => {
            if (typeof m.extras.streamingChannelId === 'string') {
              setStreamingChannelId(m.extras.streamingChannelId);
            }
            if (auth.uid && m.userIdHash === auth.uid && (m.role === 'streamer' || m.role === 'manager')) {
              setCanModerate(true);
            }
            if (!m.profileImageUrl && !profileImageCache.current[m.userIdHash] && !pendingProfiles.current.has(m.userIdHash)) {
              // ponytail: chat WS profiles omit profileImageUrl, so backfill from profile-card,
              // deduped per user per session. No concurrency cap yet — add a rate limiter if the API throttles.
              pendingProfiles.current.add(m.userIdHash);
              getProfileCard(status.chatChannelId, m.userIdHash, auth.cookie)
                .then((pc) => {
                  if (pc.profileImageUrl) {
                    profileImageCache.current[m.userIdHash] = pc.profileImageUrl;
                    setProfileImages({ ...profileImageCache.current });
                  }
                })
                .catch(() => undefined)
                .finally(() => pendingProfiles.current.delete(m.userIdHash));
            }
            enqueueLog(channelId, m);
            setMessages((prev) => {
              if (isDuplicate(prev, m)) return prev;
              return prev.length >= MAX_MESSAGES ? [...prev.slice(-(MAX_MESSAGES - 1)), m] : [...prev, m];
            });
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

  return {
    connState,
    liveStatus,
    chatChannelId,
    messages,
    notice,
    streamingChannelId,
    canModerate,
    emojiMap,
    profileImages,
    sendChat,
    retry,
  };
}
