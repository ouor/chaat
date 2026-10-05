import { useCallback, useEffect, useRef, useState } from 'react';

import { getAccessToken, getLiveStatus, getProfileCard } from '@/client/chzzk/rest';
import { ChatSocket, type ConnState } from '@/client/chzzk/socket';
import type { ChatMessage } from '@/client/chzzk/types';
import { useEmojiMap } from '@/store/emoji-map';
import { enqueueLog } from '@/storage/log-repo';

const MAX_MESSAGES = 500;
// Burst chat arrives as many frames per second; commit them to state at most this often.
const COMMIT_MS = 100;
// Reconnect re-requests the last 50 recent chats; they can only overlap the tail of the list.
const DEDUP_WINDOW = 100;
const PROFILE_CONCURRENCY = 4;

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
  const emojiMap = useEmojiMap(channelId, auth.cookie);
  const [profileImages, setProfileImages] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<ChatSocket | null>(null);
  // Users already looked up (found, no image, or failed) — each is fetched at most once.
  const requestedProfiles = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let socket: ChatSocket | null = null;
    let pending: ChatMessage[] = [];
    let commitTimer: ReturnType<typeof setTimeout> | null = null;
    const requested = requestedProfiles.current;
    const profileQueue: string[] = [];
    let profilesInFlight = 0;

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

    const pumpProfiles = (cid: string) => {
      while (!cancelled && profilesInFlight < PROFILE_CONCURRENCY && profileQueue.length > 0) {
        const id = profileQueue.shift() as string;
        profilesInFlight += 1;
        getProfileCard(cid, id, auth.cookie)
          .then((pc) => {
            const url = pc.profileImageUrl;
            if (url) setProfileImages((prev) => ({ ...prev, [id]: url }));
          })
          .catch(() => undefined)
          .finally(() => {
            profilesInFlight -= 1;
            pumpProfiles(cid);
          });
      }
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
        setChatChannelId(status.chatChannelId);

        socket = new ChatSocket({
          chatChannelId: status.chatChannelId,
          streamingChannelId: channelId,
          getAccessToken: () => getAccessToken(status.chatChannelId, auth.cookie),
          uid: auth.uid,
          onMessage: (m) => {
            if (typeof m.extras.streamingChannelId === 'string') {
              setStreamingChannelId(m.extras.streamingChannelId);
            }
            if (auth.uid && m.userIdHash === auth.uid && (m.role === 'streamer' || m.role === 'manager')) {
              setCanModerate(true);
            }
            if (!m.profileImageUrl && !requested.has(m.userIdHash)) {
              // ponytail: chat WS profiles omit profileImageUrl, so backfill from profile-card,
              // once per user, at most PROFILE_CONCURRENCY in flight. Failed lookups aren't retried
              // this session; add a retry with backoff if transient failures show up as missing avatars.
              requested.add(m.userIdHash);
              profileQueue.push(m.userIdHash);
              pumpProfiles(status.chatChannelId);
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
      } catch {
        if (!cancelled) setConnState('offline');
      }
    })();

    return () => {
      cancelled = true;
      if (commitTimer) clearTimeout(commitTimer);
      // Never fetched: let the next session look these users up.
      for (const id of profileQueue) requested.delete(id);
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
