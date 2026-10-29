import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { clearChatNotice, postChatNotice, type ModerationTarget } from '@/store/channel';

/** Moderator sheet to pin a notice on the chat room, or take the current one down. */
export function NoticeComposer({
  visible,
  onClose,
  target,
  uid,
  hasNotice,
}: {
  visible: boolean;
  onClose: () => void;
  target: ModerationTarget | null;
  uid?: string;
  hasNotice: boolean;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  function handlePost() {
    const text = draft.trim();
    if (!target || !uid || !text) return;
    void postChatNotice(target, uid, text)
      .then(() => {
        setDraft('');
        close();
      })
      .catch(() => setError('공지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }

  function handleClear() {
    if (!target || !uid) return;
    void clearChatNotice(target, uid)
      .then(close)
      .catch(() => setError('공지를 내리지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="공지 올리기"
      description="채팅창 맨 위에 고정돼서 모든 시청자에게 보여요."
      actions={
        <>
          {hasNotice ? <Button label="지금 공지 내리기" variant="danger" stretch onPress={handleClear} /> : null}
          <Button label="올리기" stretch onPress={handlePost} />
        </>
      }>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="공지 내용을 입력하세요"
        placeholderTextColor={theme.mute}
        multiline
        style={[Type.body, styles.input, { backgroundColor: theme.canvas, color: theme.ink }]}
      />
      {error ? (
        <Text variant="label" tone="danger">
          {error}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    // About four lines before it scrolls.
    minHeight: 96,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    textAlignVertical: 'top',
  },
});
