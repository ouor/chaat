import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '@/client/chzzk/types';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type FontScale } from '@/store/settings';

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

export const ChatRow = memo(function ChatRow({
  m,
  showTime,
  onPress,
  burst,
}: {
  m: ChatMessage;
  showTime: boolean;
  onPress?: () => void;
  burst?: boolean;
}) {
  const theme = useTheme();
  const { fontScale, chatVariant } = useSettings();
  const font = CHAT_FONT[fontScale];
  const isCard = chatVariant === 'card' && !burst;
  const nickColor = theme[nickKey(m.userIdHash)];
  const dim = burst ? 0.78 : 1;

  const pressableProps = onPress ? { onPress } : {};

  if (m.msgType === 'system') {
    return <Text style={[styles.system, { color: theme.mute, opacity: dim }]}>{m.message}</Text>;
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
          <Text style={[styles.donoNick, { color: theme.primarySoft, opacity: dim }]}>{m.nickname}</Text>
          {amount ? (
            <Text style={[styles.donoAmount, { color: theme.primarySoft, fontSize: isCard ? 17 : 13 }]}>{amount}</Text>
          ) : null}
        </View>
        <Text style={[styles.donoMsg, { color: theme.ink, fontSize: font, opacity: dim }]} numberOfLines={burst ? 1 : undefined}>
          {m.message}
        </Text>
      </Pressable>
    );
  }

  if (m.msgType === 'subscription') {
    return (
      <View style={[styles.sub, isCard && styles.donoCard, { borderColor: theme.hairline }]}>
        <Text style={[styles.subLabel, { color: theme.primarySoft }]}>SUB</Text>
        <Text style={[styles.subText, { color: theme.body, fontSize: font, opacity: dim }]}>{m.message}</Text>
      </View>
    );
  }

  if (isCard) {
    return (
      <Pressable {...pressableProps} style={styles.cardRow}>
        <View style={[styles.cardAvatar, { backgroundColor: theme.canvasSoft, borderColor: theme.hairline }]}>
          <Text style={[styles.cardAvatarText, { color: theme.mute }]}>{(m.nickname[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardNickLine}>
            <RoleBadge role={m.role} />
            <Text style={[styles.cardNick, { color: nickColor }]} numberOfLines={1}>
              {m.nickname}
            </Text>
            {showTime ? <Text style={[styles.time, { color: theme.mute }]}>{fmtTime(m.msgTime)}</Text> : null}
          </View>
          <Text style={[styles.cardMsg, { color: theme.ink, fontSize: font }]}>{m.message}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable {...pressableProps} style={styles.chatRow}>
      <View style={styles.chatLine}>
        {!burst ? <RoleBadge role={m.role} /> : null}
        <Text style={[styles.nick, { color: nickColor }]} numberOfLines={1}>
          {m.nickname}
        </Text>
        <Text style={[styles.message, { color: theme.ink, fontSize: font, opacity: dim }]} numberOfLines={burst ? 1 : undefined}>
          {m.message}
        </Text>
        {showTime && !burst ? <Text style={[styles.time, { color: theme.mute }]}>{fmtTime(m.msgTime)}</Text> : null}
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
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  nick: {
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
    maxWidth: '40%',
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
  donoMsg: {
    fontSize: 14,
    lineHeight: 20,
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
  cardAvatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  cardAvatarText: { fontSize: 10, fontWeight: 600 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardNickLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardNick: { fontSize: 13, fontWeight: 600, flexShrink: 1 },
  cardMsg: { fontSize: 14, lineHeight: 20 },
});
