import { useEffect, useState } from 'react';

import type { ChatMessage } from '@/client/chzzk/types';
import { enqueueLog } from '@/storage/log-repo';

// Mock live chat for web/DOM analysis: keeps appending new messages so the rendered
// HTML/CSS update can be inspected in browser devtools without any network dependency.
const NAMES = ['minjae', 'gyu', 'soobs', 'tiga', 'haneul', 'oz', 'rei', 'bora', 'nate', 'pip', 'Aria'];
const TEXTS = [
  '안녕하세요!',
  'ㅋㅋㅋㅋ',
  '오늘 방송 뭐 하세요?',
  '와 대박',
  '한 판 더 해주세요',
  '저도요',
  '감사합니다',
  '이거 클립 ㄱㄱ',
  'ㅎㅎㅎ',
  '소리 잘 들려요',
  '잘 보고 있어요',
];

export interface MockChatSession {
  connState: 'connected';
  liveStatus: 'OPEN';
  chatChannelId: string | null;
  messages: ChatMessage[];
  notice: string | null;
  streamingChannelId: string | null;
  canModerate: boolean;
  emojiMap: Record<string, string>;
  sendChat: () => void;
  retry: () => void;
}

export function useMockChatSession(enabled: boolean): MockChatSession {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let i = 0;
    const t = setInterval(() => {
      const donation = i % 10 === 3;
      const m: ChatMessage = {
        chatChannelId: 'mock',
        userIdHash: `user${i % 6}`,
        nickname: NAMES[i % NAMES.length],
        message: `${TEXTS[i % TEXTS.length]} #${i}`,
        msgType: donation ? 'donation' : 'text',
        role: i % 13 === 0 ? 'streamer' : i % 7 === 0 ? 'manager' : 'member',
        msgTime: Date.now(),
        extras: {},
        donationAmount: donation ? 5000 + (i % 5) * 1000 : undefined,
      };
      i += 1;
      setMessages((prev) => (prev.length >= 300 ? [...prev.slice(-299), m] : [...prev, m]));
      enqueueLog('mock', m);
    }, 700);
    return () => clearInterval(t);
  }, [enabled]);

  return {
    connState: 'connected',
    liveStatus: 'OPEN',
    chatChannelId: 'mock',
    messages,
    notice: null,
    streamingChannelId: null,
    canModerate: false,
    emojiMap: {},
    sendChat: () => undefined,
    retry: () => undefined,
  };
}
