import { useEffect, useState } from 'react';

import type { ChatMessage } from '@/client/chzzk/types';
import type { ChatSession } from '@/store/chat-session';
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
  '방송 끝나고도 채팅 계속 볼 수 있는 거 진짜 편하네요 오늘도 수고 많으셨어요',
];

/** `ended` renders the after-stream state (`/chat/mock?ended=1`). */
export function useMockChatSession(enabled: boolean, ended = false): ChatSession {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let i = 0;
    const t = setInterval(() => {
      const donation = i % 10 === 3;
      const m: ChatMessage = {
        chatChannelId: 'mock',
        userIdHash: `user${i % 6}`,
        // Every other donation is anonymous: those arrive with no sender nickname.
        nickname: donation && i % 20 === 13 ? '' : NAMES[i % NAMES.length],
        message: `${TEXTS[i % TEXTS.length]} #${i}`,
        msgType: donation ? 'donation' : 'text',
        role: i % 13 === 0 ? 'streamer' : i % 7 === 0 ? 'manager' : 'member',
        msgTime: Date.now(),
        extras: {},
        donationAmount: donation ? 5000 + (i % 5) * 1000 : undefined,
      };
      i += 1;
      setMessages((prev) => (prev.length >= 300 ? [...prev.slice(-299), m] : [...prev, m]));
      // Archived under channel 'mock' too, so the log viewer and export can be exercised offline.
      enqueueLog('mock', m);
    }, 700);
    return () => clearInterval(t);
  }, [enabled]);

  return {
    connState: 'connected',
    liveStatus: ended ? 'CLOSE' : 'OPEN',
    chatChannelId: 'mock',
    messages,
    notice: null,
    streamingChannelId: null,
    canModerate: false,
    adultOnly: false,
    viewers: ended ? null : 1234,
    emojiMap: {},
    sendChat: () => true,
    retry: () => undefined,
    setReading: () => undefined,
  };
}
