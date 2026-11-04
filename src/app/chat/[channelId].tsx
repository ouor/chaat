import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chatKey } from '@/client/chzzk/protocol';
import type { ChatMessage } from '@/client/chzzk/types';
import { ChatRow } from '@/components/chat/chat-row';
import { NoticeComposer } from '@/components/chat/notice-composer';
import { ProfileSheet } from '@/components/chat/profile-sheet';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { LiveBadge } from '@/components/ui/live-badge';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { Radius, Size, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useFollowNewest } from '@/hooks/use-follow-newest';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { useChannelDetail } from '@/store/channel';
import { useChatSession } from '@/store/chat-session';
import { toggleFavorite, useFavorites } from '@/store/favorites';
import { useMockChatSession } from '@/store/mock-chat-session';
import { requestProfileImages } from '@/store/profile-images';

type StatusColor = 'accentText' | 'mute' | 'danger';

const CONN_META: Record<string, { label: string; color: StatusColor }> = {
  connecting: { label: '연결 중…', color: 'mute' },
  connected: { label: '연결됨', color: 'mute' },
  reconnecting: { label: '다시 연결 중…', color: 'mute' },
  offline: { label: '연결 끊김', color: 'danger' },
  unavailable: { label: '채팅 없음', color: 'mute' },
};

export default function ChatScreen() {
  const { channelId, ended } = useLocalSearchParams<{ channelId: string; ended?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const { loggedIn, cookie, uid } = useAuth();
  const favorites = useFavorites();
  // Dev-only preview room (web/DOM checks); release builds treat 'mock' as an invalid channel.
  const isMock = __DEV__ && channelId === 'mock';
  const fav = favorites.find((f) => f.channelId === channelId);
  // Favorites already know the name/image, so the header is right before getChannel returns.
  const detail = useChannelDetail(channelId, !isMock);
  const name = detail?.channelName ?? fav?.channelName ?? (isMock ? '미리보기 채널' : '');
  const real = useChatSession(channelId, { cookie, uid }, name);
  const mock = useMockChatSession(isMock, ended === '1');
  const { connState, liveStatus, messages, notice, chatChannelId, streamingChannelId, canModerate, adultOnly, viewers, emojiMap, sendChat, retry, setReading } =
    isMock ? mock : real;

  const [draft, setDraft] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [readOnlyHidden, setReadOnlyHidden] = useState(false);

  // Avatars are backfilled only for rows on screen (see profile-images). FlatList forbids swapping
  // onViewableItemsChanged, so the handler is created once and reads the chat room id from a ref.
  const chatChannelIdRef = useRef<string | null>(null);
  useEffect(() => {
    chatChannelIdRef.current = chatChannelId;
  }, [chatChannelId]);
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: ViewToken<ChatMessage>[] }) => {
    const cid = chatChannelIdRef.current;
    if (!cid) return;
    const ids = viewableItems.flatMap((v) => (v.item && !v.item.profileImageUrl ? [v.item.userIdHash] : []));
    if (ids.length > 0) requestProfileImages(cid, ids);
  });

  const image = detail?.channelImageUrl || fav?.channelImageUrl || null;
  const data = useMemo(() => [...messages].reverse(), [messages]);
  const { listProps, unread, jumpBottom } = useFollowNewest(data, setReading);

  const conn = CONN_META[connState] ?? CONN_META.connecting;
  const isLive = liveStatus === 'OPEN';
  const isEnded = liveStatus === 'CLOSE';
  // One short status, said once. Green only while live; an ended stream gets no dot at all.
  const status: { label: string; dot: StatusColor | null } =
    connState !== 'connected'
      ? { label: conn.label, dot: conn.color }
      : isLive
        ? { label: viewers != null ? `실시간 · ${viewers.toLocaleString()}명 시청 중` : '실시간', dot: 'accentText' }
        : isEnded
          ? { label: '방송 종료', dot: null }
          : { label: conn.label, dot: conn.color };

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <ChatRow m={item} emojiMap={emojiMap} onPress={setSelected} />,
    [emojiMap],
  );

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    // Keep the draft when the socket is between connections instead of silently dropping it.
    if (sendChat(text)) setDraft('');
  }

  const moderation =
    canModerate && loggedIn && chatChannelId && streamingChannelId && cookie
      ? { chatChannelId, streamingChannelId, cookie }
      : null;
  const bottomPad = Math.max(insets.bottom, Spacing.md);

  return (
    // Edge-to-edge (edgeToEdgeEnabled) makes adjustResize a no-op, so the window no longer shrinks
    // for the keyboard; pad the screen by the keyboard height instead or it covers the input bar.
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: theme.canvas }]}>
      <ScreenHeader
        right={
          <>
            <IconButton
              name={fav ? 'starFilled' : 'star'}
              label={fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}
              color={fav ? 'ink' : 'mute'}
              onPress={() =>
                toggleFavorite({ channelId, channelName: name || channelId, channelImageUrl: image ?? '' })
              }
            />
            <Button
              label="지난 채팅"
              size="chip"
              variant="tonal"
              icon="history"
              accessibilityLabel="이 폰에 저장된 지난 채팅 보기"
              onPress={() => router.push({ pathname: '/logs/[channelId]', params: { channelId, name } })}
            />
            {moderation ? (
              <IconButton name="megaphone" label="공지 올리기" color="body" onPress={() => setComposerOpen(true)} />
            ) : null}
          </>
        }>
        <View style={styles.headerMain}>
          <Avatar uri={image} name={name || '?'} size="sm" />
          <View style={styles.headerTitle}>
            <View style={styles.headerTitleRow}>
              <Text variant="bodyStrong" style={styles.channelName} numberOfLines={1}>
                {name}
              </Text>
              {isLive ? <LiveBadge /> : null}
            </View>
            <View style={styles.connRow}>
              {status.dot ? <View style={[styles.connDot, { backgroundColor: theme[status.dot] }]} /> : null}
              <Text variant="micro" tone="body" numberOfLines={1}>
                {status.label}
              </Text>
            </View>
          </View>
        </View>
      </ScreenHeader>

      {connState === 'offline' ? (
        <View style={[styles.banner, { backgroundColor: theme.surface }]}>
          <Text variant="label" style={styles.bannerText}>
            연결이 끊겼어요
          </Text>
          <Button label="다시 연결" size="sm" variant="secondary" onPress={retry} />
        </View>
      ) : null}

      {notice ? (
        <Pressable
          onPress={() => setNoticeOpen((v) => !v)}
          accessibilityLabel={noticeOpen ? '공지 접기' : '공지 펼치기'}
          style={[styles.notice, { backgroundColor: theme.surface }]}>
          <Icon name="megaphone" color={theme.ink} size="md" />
          <Text variant="labelRegular" style={styles.noticeText} numberOfLines={noticeOpen ? undefined : 1}>
            {notice}
          </Text>
          <View style={{ transform: [{ rotate: noticeOpen ? '180deg' : '0deg' }] }}>
            <Icon name="down" color={theme.mute} size="sm" />
          </View>
        </Pressable>
      ) : null}

      <View style={styles.listArea}>
        {/* shortcut: FlatList (RN core), not FlashList 2: FlashList 2's recycler +
            maintainVisibleContentPosition misrendered here (blank rows, forced scroll to the
            bottom). Rows are memoized and the list is capped (500 / 2000 while reading).
            Upgrade path: retry FlashList 2 in a dev build with inverted-style chat. */}
        <FlatList
          {...listProps}
          inverted
          data={data}
          // Content-based key (same identity as the store dedup): an index key would shift on every
          // new message in this reversed list and remount every visible row.
          keyExtractor={chatKey}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={renderItem}
          // Bursts of ~30 chats/s: render a smaller window around the viewport so each batch
          // updates fewer cells (default windowSize 21 = ten screens each way).
          windowSize={7}
          maxToRenderPerBatch={8}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            // Inverted: the header sits at the newest end, in flow, so it never covers a row.
            isEnded && connState === 'connected' && data.length > 0 ? (
              <Text variant="caption" tone="body" style={styles.endedNote}>
                채팅방은 계속 열려 있어요. 새 채팅이 오면 바로 보여요.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            connState === 'unavailable' && adultOnly ? (
              <EmptyState
                icon="lock"
                title="연령 제한 방송이에요"
                hint={
                  loggedIn
                    ? '성인 인증을 마친 네이버 계정이어야 채팅을 볼 수 있어요.'
                    : '네이버로 로그인하면 채팅을 볼 수 있어요. 성인 인증을 마친 계정이어야 해요.'
                }>
                {loggedIn ? null : <Button label="로그인" onPress={() => router.push('/login')} />}
              </EmptyState>
            ) : connState === 'unavailable' ? (
              <EmptyState
                icon="chat"
                title="이 채널은 채팅을 볼 수 없어요"
                hint="아직 방송한 적이 없거나 채팅이 막혀 있는 채널이에요."
              />
            ) : connState === 'connected' ? (
              <EmptyState icon="chat" title="아직 채팅이 없어요" hint="새 채팅이 올라오면 바로 여기에 보여드릴게요." />
            ) : (
              <EmptyState loading title={conn.label} />
            )
          }
        />

        {unread > 0 ? (
          <View pointerEvents="box-none" style={styles.unreadWrap}>
            <Button
              label={`새 메시지 ${unread > 999 ? '999+' : unread}개`}
              variant="inverse"
              icon="down"
              pill
              onPress={jumpBottom}
            />
          </View>
        ) : null}
      </View>

      {loggedIn ? (
        <View style={[styles.inputBar, { paddingBottom: bottomPad, borderTopColor: theme.hairline }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            placeholder="채팅 보내기"
            placeholderTextColor={theme.mute}
            returnKeyType="send"
            style={[Type.body, styles.textInput, { backgroundColor: theme.surface, color: theme.ink }]}
          />
          <View style={styles.send}>
            <Button label="전송" accessibilityLabel="보내기" pill disabled={!draft.trim()} onPress={handleSend} />
          </View>
        </View>
      ) : !readOnlyHidden ? (
        <View style={[styles.inputBar, { paddingBottom: bottomPad, borderTopColor: theme.hairline }]}>
          <Icon name="lock" color={theme.mute} size="md" />
          <View style={styles.readOnlyText}>
            <Text variant="labelStrong">보기만 하는 중이에요</Text>
            <Text variant="micro" tone="mute">
              채팅을 보내려면 로그인해 주세요
            </Text>
          </View>
          <Button label="로그인" size="sm" onPress={() => router.push('/login')} />
          <IconButton name="close" label="안내 닫기" color="mute" size="md" onPress={() => setReadOnlyHidden(true)} />
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}

      <NoticeComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        target={moderation}
        uid={uid}
        hasNotice={!!notice}
      />

      <ProfileSheet
        message={selected}
        chatChannelId={chatChannelId}
        cookie={cookie}
        moderation={moderation}
        onMention={loggedIn ? (nickname) => setDraft(`@${nickname} `) : undefined}
        onClose={() => setSelected(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.tight },
  channelName: { flexShrink: 1 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  connDot: { width: Size.dot, height: Size.dot, borderRadius: Radius.pill },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
  },
  bannerText: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  noticeText: { flex: 1 },
  endedNote: { textAlign: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  listArea: { flex: 1 },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingVertical: Spacing.xs },
  unreadWrap: { position: 'absolute', left: 0, right: 0, bottom: Spacing.md, alignItems: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  readOnlyText: { flex: 1, minWidth: 0 },
  textInput: {
    flex: 1,
    height: TOUCH,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 0,
    borderRadius: Radius.pill,
  },
  send: { marginRight: Spacing.sm },
});
