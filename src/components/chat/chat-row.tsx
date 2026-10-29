import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';
import { Avatar } from '@/components/ui/avatar';
import { Tag } from '@/components/ui/tag';
import { Text as UIText } from '@/components/ui/text';
import { BLINDED_TEXT, displayNickname } from '@/constants/chat-text';
import { ChatFont, chatType, Radius, Size, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { hhmm } from '@/lib/time';
import { useProfileImage } from '@/store/profile-images';
import { useSettings } from '@/store/settings';
import { EmojiText } from '@/components/chat/emoji-text';

const NICKS = ['nick1', 'nick2', 'nick3', 'nick4', 'nick5', 'nick6'] as const;

/** Stable per-user hue from the user hash, so one person keeps one color. */
function nickKey(hash: string): (typeof NICKS)[number] {
  let n = 0;
  for (const ch of hash) n = (n * 31 + ch.charCodeAt(0)) | 0;
  return NICKS[Math.abs(n) % NICKS.length];
}

function RoleBadge({ role }: { role: ChatMessage['role'] }) {
  if (role === 'streamer') return <Tag label="스트리머" tone="inverse" />;
  if (role === 'manager') return <Tag label="매니저" />;
  return null;
}

export const ChatRow = memo(function ChatRow({
  m,
  onPress,
  emojiMap,
}: {
  m: ChatMessage;
  // Takes the message so the list can pass one stable callback and keep memo intact.
  onPress?: (m: ChatMessage) => void;
  emojiMap?: Record<string, string>;
}) {
  const theme = useTheme();
  const { fontScale, chatVariant } = useSettings();
  const t = chatType(ChatFont[fontScale]);
  const isCard = chatVariant === 'card';
  const emojis = emojiMap ?? {};
  // Subscribes to this row's user only, so one user's backfill doesn't re-render every row.
  const backfilledImage = useProfileImage(m.profileImageUrl ? '' : m.userIdHash);
  const profileImage = m.profileImageUrl || backfilledImage;
  const nickStyle = [t.nick, { color: theme[nickKey(m.userIdHash || m.nickname)] }];

  const pressableProps = onPress ? { onPress: () => onPress(m) } : {};
  const body = m.blinded ? (
    <Text style={[t.body, { color: theme.mute }]}>{BLINDED_TEXT}</Text>
  ) : (
    <EmojiText text={m.message} emojiMap={emojis} messageEmojis={m.emojis} fontSize={t.body.fontSize} color={theme.ink} />
  );

  if (m.msgType === 'system') {
    return (
      <UIText variant="caption" tone="mute" style={styles.system}>
        {m.message}
      </UIText>
    );
  }

  if (m.msgType === 'donation') {
    const amount = m.donationAmount ? `₩${m.donationAmount.toLocaleString()}` : '';
    // Anonymous donations arrive without a sender nickname.
    const anonymous = !m.nickname;
    return (
      <Pressable
        {...pressableProps}
        style={[styles.dono, { backgroundColor: theme.primaryTint, borderLeftColor: theme.primary }]}>
        <View style={styles.donoHead}>
          <Text style={[styles.donoNick, t.donor]} numberOfLines={1}>
            <Text style={{ color: anonymous ? theme.body : theme.accentText }}>{displayNickname(m.nickname, m.msgType)}</Text>
            <Text style={[t.small, { color: theme.body }]}> 님의 후원</Text>
          </Text>
          {amount ? (
            <Text style={[styles.donoAmount, isCard ? t.amountCard : t.amount, { color: theme.accentText }]}>
              {amount}
            </Text>
          ) : null}
        </View>
        {m.message || m.blinded ? body : null}
      </Pressable>
    );
  }

  if (m.msgType === 'subscription') {
    return (
      <View style={[styles.sub, { backgroundColor: theme.surface }]}>
        <Tag label="구독" />
        <Text style={[styles.subText, t.small, { color: theme.body }]}>{m.blinded ? BLINDED_TEXT : m.message}</Text>
      </View>
    );
  }

  if (isCard) {
    return (
      <Pressable {...pressableProps} style={styles.cardRow}>
        <Avatar uri={profileImage} name={m.nickname} size="sm" />
        <View style={styles.cardBody}>
          <View style={styles.cardNickLine}>
            <RoleBadge role={m.role} />
            <Text style={[styles.nick, styles.cardNick, nickStyle]} numberOfLines={1}>
              {m.nickname}
            </Text>
            <UIText variant="micro" tone="mute">
              {hhmm(m.msgTime)}
            </UIText>
          </View>
          {body}
        </View>
      </Pressable>
    );
  }

  // One-line layout is the dense, text-only mode: no avatars, and the time leads the row as a
  // quiet fixed column instead of a ragged right edge. Shown live and ended alike.
  return (
    <Pressable {...pressableProps} style={styles.chatRow}>
      <UIText variant="micro" tone="mute" style={[styles.time, { lineHeight: t.lineHeight }]}>
        {hhmm(m.msgTime)}
      </UIText>
      {m.role !== 'member' ? (
        <View style={[styles.badgeSlot, { height: t.lineHeight }]}>
          <RoleBadge role={m.role} />
        </View>
      ) : null}
      <Text style={[styles.nick, nickStyle]} numberOfLines={1}>
        {m.nickname}
      </Text>
      <View style={styles.message}>
        {body}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.tight,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.lg,
  },
  badgeSlot: { justifyContent: 'center' },
  nick: {
    flexShrink: 0,
    maxWidth: '38%',
  },
  message: { flex: 1, minWidth: 0 },
  time: { width: Size.timeColumn, flexShrink: 0, fontVariant: ['tabular-nums'] },
  system: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  dono: {
    borderLeftWidth: 3,
    borderRadius: Radius.lg,
    marginVertical: Spacing.tight,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  donoHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  donoNick: { flexShrink: 1 },
  donoAmount: { fontVariant: ['tabular-nums'] },
  sub: {
    borderRadius: Radius.lg,
    marginVertical: Spacing.tight,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subText: {
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'flex-start',
  },
  cardBody: { flex: 1, minWidth: 0, gap: Spacing.xxs },
  cardNickLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.tight },
  cardNick: { flexShrink: 1, maxWidth: undefined },
});
