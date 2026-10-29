import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';
import { Avatar } from '@/components/ui/avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { displayNickname } from '@/constants/chat-text';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { blindChat, useProfileCard, type ModerationTarget } from '@/store/channel';
import { useProfileImage } from '@/store/profile-images';

const ROLE_LABEL: Record<ChatMessage['role'], string> = {
  streamer: '스트리머',
  manager: '채팅 매니저',
  member: '시청자',
};

/** Who sent a chat, with mention (signed in) and blind (moderators) actions. */
export function ProfileSheet({
  message,
  chatChannelId,
  cookie,
  moderation,
  onMention,
  onClose,
}: {
  message: ChatMessage | null;
  chatChannelId: string | null;
  cookie?: string;
  /** Set when the viewer may blind chats in this room. */
  moderation: ModerationTarget | null;
  /** Set when the viewer can send chats; receives the sender's nickname. */
  onMention?: (nickname: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [confirmBlind, setConfirmBlind] = useState(false);
  // Moderation calls can fail (expired session, permission); say so instead of a dead button.
  const [error, setError] = useState<string | null>(null);
  const card = useProfileCard(chatChannelId, message?.userIdHash ?? null, cookie);
  const backfilledImage = useProfileImage(message && !message.profileImageUrl ? message.userIdHash : '');

  function close() {
    setError(null);
    setConfirmBlind(false);
    onClose();
  }

  function handleBlind() {
    if (!message || !moderation) return;
    if (!confirmBlind) {
      setConfirmBlind(true);
      return;
    }
    void blindChat(moderation, message)
      .then(close)
      .catch(() => setError('메시지를 가리지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }

  if (!message) return <BottomSheet visible={false} onClose={close} />;

  const name = displayNickname(message.nickname, message.msgType);
  const role = ROLE_LABEL[message.role];
  const meta = card?.streamingProperty.subscription
    ? `구독 ${card.streamingProperty.subscription.accumulativeMonth}개월 · ${role}`
    : card?.streamingProperty.following
      ? `팔로우 중 · ${role}`
      : role;

  return (
    <BottomSheet
      visible
      onClose={close}
      actions={
        <>
          {moderation ? (
            <Button
              label={confirmBlind ? '한 번 더 누르면 가려져요' : '메시지 가리기'}
              variant="danger"
              stretch
              onPress={handleBlind}
            />
          ) : null}
          {onMention ? (
            <Button
              label="멘션하기"
              stretch
              onPress={() => {
                onMention(message.nickname);
                close();
              }}
            />
          ) : (
            <Button label="닫기" variant="secondary" stretch onPress={close} />
          )}
        </>
      }>
      <View style={styles.head}>
        <Avatar uri={message.profileImageUrl || backfilledImage} name={name} size="lg" />
        <View style={styles.title}>
          <Text variant="title" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="mute">
            {meta}
          </Text>
        </View>
      </View>
      {message.message ? (
        <View style={[styles.message, { backgroundColor: theme.canvas }]}>
          <Text variant="body">{message.message}</Text>
        </View>
      ) : null}
      {error ? (
        <Text variant="label" tone="danger">
          {error}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { flex: 1, gap: Spacing.xxs },
  message: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
