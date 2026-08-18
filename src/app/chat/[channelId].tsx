import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatRow } from '@/components/chat/chat-row';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { useChatSession } from '@/store/chat-session';

// ponytail: Expo Go SDK 57 (New Arch) fails to paint ScrollView/FlatList content on this
// device — everything inside a scroll container renders black while plain Views paint fine.
// Workaround: render the latest window of messages in a plain View pinned to the bottom
// (no scroll-back). Upgrade path: verify scroll containers on a dev build and restore a
// virtualized list once they paint.
const VISIBLE = 60;

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
  const { loggedIn, cookie, uid } = useAuth();
  const { connState, liveStatus, messages, sendChat, retry } = useChatSession(channelId, { cookie, uid });

  const [draft, setDraft] = useState('');

  const conn = CONN_META[connState] ?? CONN_META.connecting;
  const isLive = liveStatus === 'OPEN';
  const isEnded = liveStatus === 'CLOSE';
  const visible = messages.slice(-VISIBLE);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    sendChat(text);
    setDraft('');
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

      <View style={[styles.stream, { backgroundColor: isEnded ? theme.canvasSoft : theme.canvas }]}>
        {messages.length === 0 ? (
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
        ) : (
          visible.map((m, i) => <ChatRow key={String(i)} m={m} showTime={isEnded} />)
        )}
      </View>

      {loggedIn ? (
        <View
          style={[
            styles.inputBar,
            { backgroundColor: theme.canvas, borderTopColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) },
          ]}>
          <View style={styles.inputInner}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              placeholder="Send a message"
              placeholderTextColor={theme.mute}
              returnKeyType="send"
              style={[
                styles.textInput,
                { backgroundColor: theme.canvasSoft, borderColor: theme.hairline, color: theme.ink },
              ]}
            />
            <Pressable onPress={handleSend} style={[styles.sendButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.sendText, { color: theme.onPrimary }]}>전송</Text>
            </Pressable>
          </View>
        </View>
      ) : (
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
            <Pressable
              onPress={() => router.push('/login')}
              style={[styles.signInButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.signInText, { color: theme.onPrimary }]}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  stream: { flex: 1, justifyContent: 'flex-end', paddingVertical: Spacing.sm },
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
  textInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: 14,
  },
  sendButton: {
    width: 52,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 13, fontWeight: 600 },
  signInButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  signInText: { fontSize: 13, fontWeight: 600 },
});
