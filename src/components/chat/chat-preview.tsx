import { StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';
import { ChatRow } from '@/components/chat/chat-row';
import { Radius, Spacing, Type, type ThemeColor } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

const sample = (p: Partial<ChatMessage> & Pick<ChatMessage, 'nickname' | 'message'>): ChatMessage => ({
  chatChannelId: 'preview',
  userIdHash: p.nickname,
  msgType: 'text',
  role: 'member',
  msgTime: 0,
  extras: {},
  ...p,
});

const SAMPLES: ChatMessage[] = [
  sample({ nickname: '하늘', message: '오늘 방송도 재밌었어요!' }),
  sample({ nickname: '보라', message: '다음 방송은 언제 하나요?', role: 'manager' }),
  sample({ nickname: '민재', message: '수고하셨습니다', msgType: 'donation', donationAmount: 1000 }),
];

/** Static sample chat rendered with the real ChatRow, so it follows the font/layout settings. */
export function ChatPreview({ label, surface = 'canvas' }: { label: string; surface?: ThemeColor }) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme[surface] }]} accessibilityLabel={`${label}: 채팅 예시`}>
      <Text style={[Type.micro, styles.label, { color: theme.mute }]}>{label}</Text>
      {SAMPLES.map((m) => (
        <ChatRow key={m.nickname} m={m} showTime={false} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.lg, paddingVertical: Spacing.sm },
  label: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
});
