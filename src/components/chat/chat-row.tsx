import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';
import { Radius, Spacing, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type FontScale } from '@/store/settings';
import { EmojiText } from '@/components/chat/emoji-text';

export const CHAT_FONT: Record<FontScale, number> = { sm: 14, md: 15, lg: 17, xl: 20 };

function fmtTime(t: number): string {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function RoleBadge({ role }: { role: ChatMessage['role'] }) {
  const theme = useTheme();
  if (role === 'streamer') {
    return (
      <View style={[styles.badge, { backgroundColor: theme.ink }]}>
        <Text style={[Type.badge, { color: theme.canvas }]}>스트리머</Text>
      </View>
    );
  }
  if (role === 'manager') {
    return (
      <View style={[styles.badge, { backgroundColor: theme.canvasSoft2 }]}>
        <Text style={[Type.badge, { color: theme.body }]}>매니저</Text>
      </View>
    );
  }
  return null;
}

export function ProfileThumb({ uri, name, size }: { uri?: string; name: string; size: number }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (failed || !uri) {
    return (
      <View
        style={[
          styles.thumbInitial,
          { width: size, height: size, borderRadius: Radius.pill, backgroundColor: theme.canvasSoft2 },
        ]}>
        <Text style={[styles.thumbText, { color: theme.body, fontSize: Math.max(9, size * 0.45) }]}>
          {(name[0] ?? '?').toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: Radius.pill, backgroundColor: theme.canvasSoft }}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

export const ChatRow = memo(function ChatRow({
  m,
  showTime,
  onPress,
  emojiMap,
  profileImage: backfilledImage,
}: {
  m: ChatMessage;
  showTime: boolean;
  // Takes the message so the list can pass one stable callback and keep memo intact.
  onPress?: (m: ChatMessage) => void;
  emojiMap?: Record<string, string>;
  /** Backfilled image for this row's user only, so one user's backfill doesn't re-render every row. */
  profileImage?: string;
}) {
  const theme = useTheme();
  const { fontScale, chatVariant } = useSettings();
  const font = CHAT_FONT[fontScale];
  const isCard = chatVariant === 'card';
  const emojis = emojiMap ?? {};
  const profileImage = m.profileImageUrl || backfilledImage;
  // One nickname color for everyone: per-user hues read as a status code nobody could decode.
  const nickStyle = { color: theme.body, fontSize: font - 1, lineHeight: font + 6 };

  const pressableProps = onPress ? { onPress: () => onPress(m) } : {};

  if (m.msgType === 'system') {
    return <Text style={[Type.caption, styles.system, { color: theme.mute }]}>{m.message}</Text>;
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
          <Text style={[styles.donoNick, { fontSize: font - 1 }]} numberOfLines={1}>
            <Text style={{ color: anonymous ? theme.body : theme.primarySoft }}>{anonymous ? '익명' : m.nickname}</Text>
            <Text style={{ color: theme.mute, fontWeight: 400 }}>{anonymous ? ' 후원' : ' 님의 후원'}</Text>
          </Text>
          {amount ? (
            <Text style={[styles.donoAmount, { color: theme.primarySoft, fontSize: isCard ? font + 3 : font + 1 }]}>
              {amount}
            </Text>
          ) : null}
        </View>
        {m.message ? (
          <EmojiText text={m.message} emojiMap={emojis} messageEmojis={m.emojis} fontSize={font} color={theme.ink} />
        ) : null}
      </Pressable>
    );
  }

  if (m.msgType === 'subscription') {
    return (
      <View style={[styles.sub, { backgroundColor: theme.canvasSoft }]}>
        <View style={[styles.badge, { backgroundColor: theme.canvasSoft2 }]}>
          <Text style={[Type.badge, { color: theme.ink }]}>구독</Text>
        </View>
        <Text style={[styles.subText, { color: theme.body, fontSize: font - 1, lineHeight: font + 6 }]}>{m.message}</Text>
      </View>
    );
  }

  if (isCard) {
    return (
      <Pressable {...pressableProps} style={styles.cardRow}>
        <ProfileThumb uri={profileImage} name={m.nickname} size={32} />
        <View style={styles.cardBody}>
          <View style={styles.cardNickLine}>
            <RoleBadge role={m.role} />
            <Text style={[styles.nick, styles.cardNick, nickStyle]} numberOfLines={1}>
              {m.nickname}
            </Text>
            {showTime ? <Text style={[Type.micro, { color: theme.mute }]}>{fmtTime(m.msgTime)}</Text> : null}
          </View>
          <EmojiText text={m.message} emojiMap={emojis} messageEmojis={m.emojis} fontSize={font} color={theme.ink} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable {...pressableProps} style={styles.chatRow}>
      <View style={[styles.thumbSlot, { height: font + 6 }]}>
        <ProfileThumb uri={profileImage} name={m.nickname} size={20} />
      </View>
      {m.role !== 'member' ? (
        <View style={[styles.thumbSlot, { height: font + 6 }]}>
          <RoleBadge role={m.role} />
        </View>
      ) : null}
      <Text style={[styles.nick, nickStyle]} numberOfLines={1}>
        {m.nickname}
      </Text>
      <View style={styles.message}>
        <EmojiText text={m.message} emojiMap={emojis} messageEmojis={m.emojis} fontSize={font} color={theme.ink} />
      </View>
      {showTime ? (
        <Text style={[Type.micro, styles.time, { color: theme.mute, lineHeight: font + 6 }]}>{fmtTime(m.msgTime)}</Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.lg,
  },
  thumbSlot: { justifyContent: 'center' },
  thumbInitial: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbText: {
    fontWeight: 600,
  },
  nick: {
    fontWeight: 600,
    flexShrink: 0,
    maxWidth: '38%',
  },
  message: { flex: 1, minWidth: 0 },
  time: { flexShrink: 0 },
  badge: {
    borderRadius: Radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  system: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  dono: {
    borderLeftWidth: 3,
    borderRadius: Radius.lg,
    marginVertical: 6,
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
  donoNick: {
    flexShrink: 1,
    fontWeight: 700,
  },
  donoAmount: {
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    borderRadius: Radius.lg,
    marginVertical: 6,
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
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  cardNickLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardNick: { flexShrink: 1, maxWidth: undefined },
});
