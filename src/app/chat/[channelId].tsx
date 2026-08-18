import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/client/chzzk/types';
import { ChatRow } from '@/components/chat/chat-row';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useChatSession } from '@/store/chat-session';

const CONN_META: Record<string, { label: string; color: 'primarySoft' | 'mute' | 'danger' }> = {
  connecting: { label: 'Connecting…', color: 'mute' },
  connected: { label: 'Connected', color: 'primarySoft' },
  reconnecting: { label: 'Reconnecting…', color: 'mute' },
  offline: { label: 'Disconnected', color: 'danger' },
};

export default function ChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { connState, liveStatus, messages, retry } = useChatSession(channelId);

  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const atBottom = useRef(true);
  const prevCount = useRef(0);
  const [unread, setUnread] = useState(0);

  const conn = CONN_META[connState] ?? CONN_META.connecting;
  const isLive = liveStatus === 'OPEN';
  const isEnded = liveStatus === 'CLOSE';

  useEffect(() => {
    const count = messages.length;
    if (count === prevCount.current) return;
    const delta = count - prevCount.current;
    prevCount.current = count;
    if (!atBottom.current) setUnread((u) => u + delta);
  }, [messages.length]);

  function onScroll(e: {
    nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } };
  }) {
    const { y } = e.nativeEvent.contentOffset;
    const { height: content } = e.nativeEvent.contentSize;
    const { height: viewport } = e.nativeEvent.layoutMeasurement;
    const bottom = content - y - viewport < 40;
    if (bottom !== atBottom.current) {
      atBottom.current = bottom;
      if (bottom) setUnread(0);
    }
  }

  function jumpBottom() {
    atBottom.current = true;
    setUnread(0);
    listRef.current?.scrollToEnd({ animated: true });
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={8}>
          <Icon name="back" color={theme.body} />
        </Pressable>
        <View style={[styles.avatar, { borderColor: theme.hairline, backgroundColor: theme.canvasSoft }]}>
          <Text style={[styles.avatarText, { color: theme.mute }]}>{(channelId[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={styles.headerTitle}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.channelName, { color: theme.ink }]} numberOfLines={1}>
              {channelId}
            </Text>
            {isLive ? (
              <View style={[styles.livePill, { backgroundColor: theme.primary }]}>
                <View style={[styles.liveDot, { backgroundColor: theme.onPrimary }]} />
                <Text style={[styles.livePillText, { color: theme.onPrimary }]}>LIVE</Text>
              </View>
            ) : isEnded ? (
              <View style={[styles.afterPill, { borderColor: theme.primarySoft }]}>
                <Text style={[styles.afterPillText, { color: theme.primarySoft }]}>AFTER SHOW</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.connRow}>
            <View style={[styles.connDot, { backgroundColor: theme[conn.color] }]} />
            <Text style={[styles.connLabel, { color: theme.mute }]}>{conn.label}</Text>
          </View>
        </View>
        <Pressable style={styles.headerButton} hitSlop={8} onPress={() => router.push(`/logs/${channelId}`)}>
          <Icon name="more" color={theme.body} />
        </Pressable>
      </SafeAreaView>

      {connState === 'offline' ? (
        <View style={[styles.offlineBanner, { backgroundColor: theme.canvasSoft, borderBottomColor: theme.hairline }]}>
          <Text style={[styles.offlineText, { color: theme.danger }]}>Connection lost</Text>
          <Pressable onPress={retry} hitSlop={8}>
            <Text style={[styles.offlineRetry, { color: theme.primarySoft }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlashList
        ref={listRef}
        data={messages}
        renderItem={({ item }) => <ChatRow m={item} showTime={isEnded} />}
        keyExtractor={(_, index) => String(index)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        maintainVisibleContentPosition={{
          autoscrollToBottomThreshold: 40,
          animateAutoScrollToBottom: true,
          startRenderingFromBottom: true,
        }}
        style={{ flex: 1, backgroundColor: isEnded ? theme.canvasSoft : theme.canvas }}
        ListEmptyComponent={
          connState === 'connected' ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { borderColor: theme.hairline }]}>
                <Text style={{ color: theme.mute }}>···</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: theme.body }]}>No messages yet</Text>
              <Text style={[styles.emptyHint, { color: theme.mute }]}>
                You are first in. New messages appear here as they arrive.
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={{ color: theme.mute }}>{conn.label}…</Text>
            </View>
          )
        }
      />

      {unread > 0 ? (
        <View pointerEvents="box-none" style={styles.unreadWrap}>
          <Pressable
            onPress={jumpBottom}
            style={[styles.unreadButton, { backgroundColor: theme.canvasSoft, borderColor: theme.hairline }]}>
            <Text style={{ color: theme.ink, fontSize: 12, fontWeight: 600 }}>
              {unread} new {unread === 1 ? 'message' : 'messages'}
            </Text>
            <Icon name="down" color={theme.ink} size={10} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.inputBar,
          { backgroundColor: theme.canvas, borderTopColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) },
        ]}>
        <View style={styles.inputInner}>
          <View style={styles.inputTextWrap}>
            <Text style={[styles.inputTitle, { color: theme.ink }]}>Read-only</Text>
            <Text style={[styles.inputHint, { color: theme.mute }]}>Sign in with Naver to join the chat.</Text>
          </View>
          <Pressable style={[styles.signInButton, { backgroundColor: theme.primary }]}>
            <Text style={[styles.signInText, { color: theme.onPrimary }]}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 12, fontWeight: 600 },
  headerTitle: { flex: 1, minWidth: 0, gap: 2 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  channelName: { fontSize: 15, fontWeight: 600, flexShrink: 1 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  liveDot: { width: 4, height: 4, borderRadius: Radius.pill },
  livePillText: { fontSize: 9, fontWeight: 700, letterSpacing: 0.6 },
  afterPill: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  afterPillText: { fontSize: 9, fontWeight: 700, letterSpacing: 0.6 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  connDot: { width: 5, height: 5, borderRadius: Radius.pill },
  connLabel: { fontSize: 11 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  offlineText: { fontSize: 12 },
  offlineRetry: { fontSize: 12, fontWeight: 600 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40, paddingTop: 120 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 13.5 },
  emptyHint: { fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  unreadWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  unreadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  inputBar: { borderTopWidth: 1 },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
  },
  inputTextWrap: { flex: 1, gap: 2 },
  inputTitle: { fontSize: 12.5, fontWeight: 600 },
  inputHint: { fontSize: 11 },
  signInButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  signInText: { fontSize: 13, fontWeight: 600 },
});
