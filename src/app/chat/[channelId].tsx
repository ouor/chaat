import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { blindMessage, deleteNotice, getChannel, getProfileCard, postNotice, type ProfileCard } from '@/client/chzzk/rest';
import type { ChatMessage } from '@/client/chzzk/types';
import { ChatRow, ProfileThumb } from '@/components/chat/chat-row';
import { ChannelAvatar } from '@/components/channel/channel-avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { useChatSession } from '@/store/chat-session';
import { useMockChatSession } from '@/store/mock-chat-session';

const CONN_META: Record<string, { label: string; color: 'primarySoft' | 'mute' | 'danger' }> = {
  connecting: { label: 'Connecting…', color: 'mute' },
  connected: { label: 'Connected', color: 'primarySoft' },
  reconnecting: { label: 'Reconnecting…', color: 'mute' },
  offline: { label: 'Disconnected', color: 'danger' },
};

function chatKey(m: ChatMessage): string {
  return `${m.msgTime}:${m.userIdHash}:${m.message}`;
}

const ROLE_LABEL: Record<ChatMessage['role'], string> = {
  streamer: 'CHANNEL OWNER',
  manager: 'MODERATOR',
  member: 'FOLLOWER',
};

export default function ChatScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const { loggedIn, cookie, uid } = useAuth();
  const isMock = channelId === 'mock';
  const real = useChatSession(channelId, { cookie, uid });
  const mock = useMockChatSession(isMock);
  const { connState, liveStatus, messages, notice, chatChannelId, streamingChannelId, canModerate, emojiMap, profileImages, sendChat, retry } =
    isMock ? mock : real;

  const [draft, setDraft] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [unread, setUnread] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState('');
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelImage, setChannelImage] = useState<string | null>(null);
  const [profileCard, setProfileCard] = useState<ProfileCard | null>(null);

  useEffect(() => {
    if (!selected || !chatChannelId) return;
    let cancelled = false;
    getProfileCard(chatChannelId, selected.userIdHash, cookie)
      .then((c) => {
        if (!cancelled) setProfileCard(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selected, chatChannelId, cookie]);

  useEffect(() => {
    let cancelled = false;
    if (isMock) return;
    getChannel(channelId)
      .then((c) => {
        if (!cancelled) {
          setChannelName(c.channelName);
          setChannelImage(c.channelImageUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [channelId, isMock]);

  const data = useMemo(() => [...messages].reverse(), [messages]);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const atBottom = useRef(true);
  const lastNewest = useRef<ChatMessage | null>(null);

  // Count arrivals by how far the previous newest message moved, not by list length:
  // once the store caps the list at MAX_MESSAGES the length stops changing.
  useEffect(() => {
    const prev = lastNewest.current;
    lastNewest.current = data[0] ?? null;
    if (!prev || atBottom.current) return;
    const idx = data.indexOf(prev);
    const delta = idx === -1 ? data.length : idx;
    if (delta > 0) setUnread((u) => u + delta);
  }, [data]);

  function onScroll(e: {
    nativeEvent: { contentOffset: { y: number } };
  }) {
    const bottom = e.nativeEvent.contentOffset.y < 20;
    if (bottom !== atBottom.current) {
      atBottom.current = bottom;
      if (bottom) setUnread(0);
    }
  }

  function jumpBottom() {
    atBottom.current = true;
    setUnread(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  const conn = CONN_META[connState] ?? CONN_META.connecting;
  const isLive = liveStatus === 'OPEN';
  const isEnded = liveStatus === 'CLOSE';

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatRow
        m={item}
        showTime={isEnded}
        emojiMap={emojiMap}
        profileImage={profileImages[item.userIdHash]}
        onPress={setSelected}
      />
    ),
    [isEnded, emojiMap, profileImages],
  );

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    sendChat(text);
    setDraft('');
  }

  function handleMention() {
    if (!selected) return;
    setDraft(`@${selected.nickname} `);
    setSelected(null);
  }

  function handleBlind() {
    if (!selected || !chatChannelId || !cookie || !streamingChannelId) return;
    void blindMessage(chatChannelId, cookie, {
      message: selected.message,
      messageTime: selected.msgTime,
      messageUserIdHash: selected.userIdHash,
      streamingChannelId,
    }).then(() => setSelected(null));
  }

  function handlePostNotice() {
    if (!chatChannelId || !cookie || !streamingChannelId || !uid) return;
    const text = noticeDraft.trim();
    if (!text) return;
    void postNotice(chatChannelId, cookie, {
      message: text,
      messageTime: Date.now(),
      messageUserIdHash: uid,
      streamingChannelId,
    }).then(() => {
      setComposerOpen(false);
      setNoticeDraft('');
    });
  }

  function handleClearNotice() {
    if (!chatChannelId || !cookie || !streamingChannelId || !uid) return;
    void deleteNotice(chatChannelId, cookie, {
      message: '',
      messageTime: Date.now(),
      messageUserIdHash: uid,
      streamingChannelId,
    }).then(() => setComposerOpen(false));
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={8}>
          <Icon name="back" color={theme.body} />
        </Pressable>
        <View style={styles.avatar}>
          <ChannelAvatar uri={channelImage} name={channelName ?? channelId} size={30} />
        </View>
        <View style={styles.headerTitle}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.channelName, { color: theme.ink }]} numberOfLines={1}>
              {channelName ?? channelId}
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
          <Icon name="history" color={theme.body} />
        </Pressable>
        {canModerate && loggedIn ? (
          <Pressable
            onPress={() => setComposerOpen(true)}
            style={[styles.noticePostButton, { borderColor: theme.primarySoft }]}
            hitSlop={8}>
            <Text style={[styles.noticePostText, { color: theme.primarySoft }]}>NOTICE</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>

      {connState === 'offline' ? (
        <View style={[styles.offlineBanner, { backgroundColor: theme.canvasSoft, borderBottomColor: theme.hairline }]}>
          <Text style={[styles.offlineText, { color: theme.danger }]}>Connection lost</Text>
          <Pressable onPress={retry} hitSlop={8}>
            <Text style={[styles.offlineRetry, { color: theme.primarySoft }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {notice ? (
        <Pressable
          onPress={() => setNoticeOpen((v) => !v)}
          style={[
            styles.noticeBanner,
            { backgroundColor: theme.canvasSoft, borderBottomColor: theme.hairline, borderLeftColor: theme.primary },
          ]}>
          <View style={styles.noticeTextWrap}>
            <Text style={[styles.noticeLabel, { color: theme.primarySoft }]}>NOTICE</Text>
            <Text style={[styles.noticeText, { color: theme.body }]} numberOfLines={noticeOpen ? undefined : 1}>
              {notice}
            </Text>
          </View>
          <Text style={{ color: theme.mute, fontSize: 10, marginTop: 8 }}>{noticeOpen ? '▲' : '▼'}</Text>
        </Pressable>
      ) : null}

      <View style={styles.listArea}>
        <FlatList
          ref={listRef}
          inverted
          data={data}
          // Content-based key (same identity as the store dedup): an index key would shift on every
          // new message in this reversed list and remount every visible row.
          keyExtractor={chatKey}
          renderItem={renderItem}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ flex: 1, backgroundColor: isEnded ? theme.canvasSoft : theme.canvas }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              {connState === 'connected' ? (
                <>
                  <View style={[styles.emptyIcon, { borderColor: theme.hairline }]}>
                    <Text style={{ color: theme.mute }}>···</Text>
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.body }]}>No messages yet</Text>
                  <Text style={[styles.emptyHint, { color: theme.mute }]}>
                    You are first in. New messages appear here as they arrive.
                  </Text>
                </>
              ) : (
                <Text style={{ color: theme.mute }}>{conn.label}…</Text>
              )}
            </View>
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

      <BottomSheet visible={composerOpen} onClose={() => setComposerOpen(false)}>
        <View style={styles.composerBody}>
          <Text style={[styles.composerLabel, { color: theme.mute }]}>POST NOTICE</Text>
          <TextInput
            value={noticeDraft}
            onChangeText={setNoticeDraft}
            placeholder="Notice message"
            placeholderTextColor={theme.mute}
            multiline
            style={[
              styles.composerInput,
              { backgroundColor: theme.canvasSoft, borderColor: theme.hairline, color: theme.ink },
            ]}
          />
          <View style={styles.composerActions}>
            <Pressable onPress={handlePostNotice} style={[styles.sheetAction, { backgroundColor: theme.primary }]}>
              <Text style={[styles.sheetActionText, { color: theme.onPrimary }]}>Post</Text>
            </Pressable>
            <Pressable onPress={handleClearNotice} style={[styles.sheetAction, { borderColor: theme.hairline }]}>
              <Text style={[styles.sheetActionText, { color: theme.danger }]}>Clear</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={!!selected} onClose={() => { setSelected(null); setProfileCard(null); }}>
        {selected ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetHead}>
              <ProfileThumb uri={selected.profileImageUrl} name={selected.nickname} size={48} />
              <View style={styles.sheetTitle}>
                <Text style={[styles.sheetNick, { color: theme.ink }]}>{selected.nickname}</Text>
                <Text style={[styles.sheetMeta, { color: theme.mute }]}>
                  {profileCard?.streamingProperty.subscription
                    ? `구독 ${profileCard.streamingProperty.subscription.accumulativeMonth}개월`
                    : profileCard?.streamingProperty.following
                      ? '팔로우 중'
                      : ROLE_LABEL[selected.role]}
                </Text>
              </View>
            </View>
            <View style={[styles.sheetMsg, { borderColor: theme.hairline, backgroundColor: theme.canvasSoft }]}>
              <Text style={[styles.sheetMsgText, { color: theme.body }]}>{selected.message}</Text>
            </View>
            <View style={styles.sheetActions}>
              <Pressable onPress={handleMention} style={[styles.sheetAction, { backgroundColor: theme.primary }]}>
                <Text style={[styles.sheetActionText, { color: theme.onPrimary }]}>Mention</Text>
              </Pressable>
              {canModerate && loggedIn && chatChannelId && streamingChannelId ? (
                <Pressable onPress={handleBlind} style={[styles.sheetAction, { borderColor: theme.hairline }]}>
                  <Text style={[styles.sheetActionText, { color: theme.danger }]}>Blind message</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </BottomSheet>
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
  },
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
  noticePostButton: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  noticePostText: { fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  composerBody: { gap: Spacing.md },
  composerLabel: { fontSize: 10, fontWeight: 600, letterSpacing: 2.5 },
  composerInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  composerActions: { flexDirection: 'row', gap: Spacing.sm },
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
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderLeftWidth: 2,
  },
  noticeTextWrap: { flex: 1, gap: 3 },
  noticeLabel: { fontSize: 9, fontWeight: 600, letterSpacing: 2.5 },
  noticeText: { fontSize: 12.5, lineHeight: 18 },
  listContent: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
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
  listArea: { flex: 1 },
  unreadWrap: { position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center' },
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
  sheetBody: { gap: Spacing.lg },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sheetTitle: { flex: 1, gap: 4 },
  sheetNick: { fontSize: 16, fontWeight: 600 },
  sheetMeta: { fontSize: 10.5, fontFamily: 'monospace' },
  sheetMsg: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  sheetMsgText: { fontSize: 13, lineHeight: 20 },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm },
  sheetAction: {
    flex: 1,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: { fontSize: 14, fontWeight: 600 },
});
