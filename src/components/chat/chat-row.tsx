import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';
import { ANONYMOUS_DONOR, BLINDED_TEXT } from '@/constants/chat-text';
import { Radius, Spacing, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useProfileImage } from '@/store/profile-images';
import { useSettings, type FontScale } from '@/store/settings';
import { EmojiText } from '@/components/chat/emoji-text';

export const CHAT_FONT: Record<FontScale, number> = { sm: 14, md: 15, lg: 17, xl: 20 };

const NICKS = ['nick1', 'nick2', 'nick3', 'nick4', 'nick5', 'nick6'] as const;

/** Stable per-user hue from the user hash, so one person keeps one color. */
function nickKey(hash: string): (typeof NICKS)[number] {
  let n = 0;
  for (const ch of hash) n = (n * 31 + ch.charCodeAt(0)) | 0;
  return NICKS[Math.abs(n) % NICKS.length];
}

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
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
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
  const font = CHAT_FONT[fontScale];
  const isCard = chatVariant === 'card';
  const emojis = emojiMap ?? {};
  // Subscribes to this row's user only, so one user's backfill doesn't re-render every row.
  const backfilledImage = useProfileImage(m.profileImageUrl ? '' : m.userIdHash);
  const profileImage = m.profileImageUrl || backfilledImage;
  const nickStyle = { color: theme[nickKey(m.userIdHash || m.nickname)], fontSize: font - 1, lineHeight: font + 6 };

  const pressableProps = onPress ? { onPress: () => onPress(m) } : {};
  const body = m.blinded ? (
    <Text style={{ color: theme.mute, fontSize: font, lineHeight: font + 6 }}>{BLINDED_TEXT}</Text>
  ) : (
    <EmojiText text={m.message} emojiMap={emojis} messageEmojis={m.emojis} fontSize={font} color={theme.ink} />
  );

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
            <Text style={{ color: anonymous ? theme.body : theme.primarySoft }}>{anonymous ? ANONYMOUS_DONOR : m.nickname}</Text>
            <Text style={{ color: theme.body, fontWeight: 400 }}> 님의 후원</Text>
          </Text>
          {amount ? (
            <Text style={[styles.donoAmount, { color: theme.primarySoft, fontSize: isCard ? font + 3 : font + 1 }]}>
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
      <View style={[styles.sub, { backgroundColor: theme.canvasSoft }]}>
        <View style={[styles.badge, { backgroundColor: theme.canvasSoft2 }]}>
          <Text style={[Type.badge, { color: theme.ink }]}>구독</Text>
        </View>
        <Text style={[styles.subText, { color: theme.body, fontSize: font - 1, lineHeight: font + 6 }]}>{m.blinded ? BLINDED_TEXT : m.message}</Text>
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
            <Text style={[Type.micro, { color: theme.mute }]}>{fmtTime(m.msgTime)}</Text>
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
      <Text style={[Type.micro, styles.time, { color: theme.mute, lineHeight: font + 6 }]}>{fmtTime(m.msgTime)}</Text>
      {m.role !== 'member' ? (
        <View style={[styles.thumbSlot, { height: font + 6 }]}>
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
    gap: 6,
    paddingVertical: 3,
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
  time: { width: 36, flexShrink: 0, fontVariant: ['tabular-nums'] },
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
