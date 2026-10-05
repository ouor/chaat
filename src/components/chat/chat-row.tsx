import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type FontScale } from '@/store/settings';
import { EmojiText } from '@/components/chat/emoji-text';

const CHAT_FONT: Record<FontScale, number> = { sm: 13, md: 14, lg: 16, xl: 18 };

const NICKS = ['nick1', 'nick2', 'nick3', 'nick4', 'nick5', 'nick6'] as const;
type NickKey = (typeof NICKS)[number];

function nickKey(hash: string): NickKey {
  let n = 0;
  for (const ch of hash) n += ch.charCodeAt(0);
  return NICKS[n % NICKS.length];
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
      <View style={[styles.badge, { backgroundColor: theme.primary }]}>
        <Text style={[styles.badgeText, { color: theme.onPrimary }]}>HOST</Text>
      </View>
    );
  }
  if (role === 'manager') {
    return (
      <View style={[styles.badge, styles.modBadge, { borderColor: theme.primarySoft }]}>
        <Text style={[styles.badgeText, { color: theme.primarySoft }]}>MOD</Text>
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
          { width: size, height: size, borderRadius: Radius.pill, backgroundColor: theme.canvasSoft, borderColor: theme.hairline },
        ]}>
        <Text style={[styles.thumbText, { color: theme.mute, fontSize: Math.max(9, size * 0.4) }]}>
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
  const nickColor = theme[nickKey(m.userIdHash)];
  const emojis = emojiMap ?? {};
  const profileImage = m.profileImageUrl || backfilledImage;

  const pressableProps = onPress ? { onPress: () => onPress(m) } : {};

  if (m.msgType === 'system') {
    return <Text style={[styles.system, { color: theme.mute }]}>{m.message}</Text>;
  }

  if (m.msgType === 'donation') {
    const amount = m.donationAmount ? `₩${m.donationAmount.toLocaleString()}` : '';
    return (
      <Pressable
        {...pressableProps}
        style={[
          styles.dono,
          isCard && styles.donoCard,
          { backgroundColor: theme.canvasSoft, borderLeftColor: theme.primary, ...(isCard ? { borderColor: theme.primary } : {}) },
        ]}>
        <View style={styles.donoHead}>
          <Text style={[styles.donoNick, { color: theme.primarySoft }]}>{m.nickname}</Text>
          {amount ? (
            <Text style={[styles.donoAmount, { color: theme.primarySoft, fontSize: isCard ? 17 : 13 }]}>{amount}</Text>
          ) : null}
        </View>
        <EmojiText text={m.message} emojiMap={emojis} fontSize={font} color={theme.ink} />
      </Pressable>
    );
  }

  if (m.msgType === 'subscription') {
    return (
      <View style={[styles.sub, isCard && styles.donoCard, { borderColor: theme.hairline }]}>
        <Text style={[styles.subLabel, { color: theme.primarySoft }]}>SUB</Text>
        <Text style={[styles.subText, { color: theme.body, fontSize: font }]}>{m.message}</Text>
      </View>
    );
  }

  if (isCard) {
    return (
      <Pressable {...pressableProps} style={styles.cardRow}>
        <ProfileThumb uri={profileImage} name={m.nickname} size={26} />
        <View style={styles.cardBody}>
          <View style={styles.cardNickLine}>
            <RoleBadge role={m.role} />
            <Text style={[styles.cardNick, { color: nickColor }]} numberOfLines={1}>
              {m.nickname}
            </Text>
            {showTime ? <Text style={[styles.time, { color: theme.mute }]}>{fmtTime(m.msgTime)}</Text> : null}
          </View>
          <EmojiText text={m.message} emojiMap={emojis} fontSize={font} color={theme.ink} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable {...pressableProps} style={styles.chatRow}>
      <View style={styles.chatLine}>
        <ProfileThumb uri={profileImage} name={m.nickname} size={18} />
        <RoleBadge role={m.role} />
        <Text style={[styles.nick, { color: nickColor }]} numberOfLines={1}>
          {m.nickname}
        </Text>
        <EmojiText text={m.message} emojiMap={emojis} fontSize={font} color={theme.ink} />
        {showTime ? <Text style={[styles.time, { color: theme.mute }]}>{fmtTime(m.msgTime)}</Text> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chatRow: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.lg,
  },
  chatLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  thumbInitial: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  thumbText: {
    fontWeight: 600,
  },
  nick: {
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
    maxWidth: '40%',
  },
  time: {
    fontSize: 9,
    fontFamily: 'monospace',
  },
  badge: {
    borderRadius: Radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  modBadge: {
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  system: {
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.lg,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  dono: {
    borderLeftWidth: 2,
    borderRadius: Radius.md,
    marginVertical: 6,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  donoHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  donoNick: {
    fontSize: 12.5,
    fontWeight: 600,
  },
  donoAmount: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  sub: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    marginVertical: 6,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subLabel: {
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: 1.2,
    fontFamily: 'monospace',
  },
  subText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  donoCard: {
    borderWidth: 1,
    marginVertical: 8,
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: Spacing.lg,
    alignItems: 'flex-start',
  },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardNickLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardNick: { fontSize: 13, fontWeight: 600, flexShrink: 1 },
});
