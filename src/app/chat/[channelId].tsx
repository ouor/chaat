import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/client/chzzk/types';
import { ChatRow, ProfileThumb } from '@/components/chat/chat-row';
import { ChannelAvatar } from '@/components/channel/channel-avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { LiveBadge } from '@/components/ui/live-badge';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ANONYMOUS_DONOR } from '@/constants/chat-text';
import { Radius, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { blindChat, clearChatNotice, postChatNotice, useChannelDetail, useProfileCard } from '@/store/channel';
import { useChatSession } from '@/store/chat-session';
import { toggleFavorite, useFavorites } from '@/store/favorites';
import { useMockChatSession } from '@/store/mock-chat-session';
import { requestProfileImages, useProfileImage } from '@/store/profile-images';

const CONN_META: Record<string, { label: string; color: 'primarySoft' | 'mute' | 'danger' }> = {
  connecting: { label: '연결 중…', color: 'mute' },
  connected: { label: '연결됨', color: 'mute' },
  reconnecting: { label: '다시 연결 중…', color: 'mute' },
  offline: { label: '연결 끊김', color: 'danger' },
  unavailable: { label: '채팅 없음', color: 'mute' },
};

function chatKey(m: ChatMessage): string {
  return `${m.msgTime}:${m.userIdHash}:${m.message}`;
}

const ROLE_LABEL: Record<ChatMessage['role'], string> = {
  streamer: '스트리머',
  manager: '채팅 매니저',
  member: '시청자',
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
  const selectedImage = useProfileImage(selected && !selected.profileImageUrl ? selected.userIdHash : '');

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
  const [confirmBlind, setConfirmBlind] = useState(false);
  // Moderation calls can fail (expired session, permission); say so instead of a dead button.
  const [actionError, setActionError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState('');
  const [readOnlyHidden, setReadOnlyHidden] = useState(false);

  const image = detail?.channelImageUrl || fav?.channelImageUrl || null;
  const profileCard = useProfileCard(chatChannelId, selected?.userIdHash ?? null, cookie);

  const data = useMemo(() => [...messages].reverse(), [messages]);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const atBottom = useRef(true);
  // Only a finger (a drag and the fling after it) may leave or rejoin the newest end. In a busy
  // room, maintainVisibleContentPosition shifts the offset on every batch and a slow list update
  // lands those shifts in onScroll late; read as "scrolled up", they flipped the room into
  // reading mode (and a 2000-row cap that made it slower still) and it never caught up again.
  const userScrolling = useRef(false);
  const lastNewest = useRef<string | null>(null);

  // Count arrivals by how far the previous newest message moved, not by list length:
  // once the store caps the list at MAX_MESSAGES the length stops changing. Matched by key, not
  // identity: a blinded row is replaced by a new object and would read as "everything is new".
  useEffect(() => {
    const prev = lastNewest.current;
    lastNewest.current = data[0] ? chatKey(data[0]) : null;
    if (!prev || atBottom.current) return;
    const idx = data.findIndex((m) => chatKey(m) === prev);
    const delta = idx === -1 ? data.length : idx;
    if (delta > 0) setUnread((u) => u + delta);
  }, [data]);

  function onScroll(e: {
    nativeEvent: { contentOffset: { y: number } };
  }) {
    const y = e.nativeEvent.contentOffset.y;
    if (!userScrolling.current) {
      // Following the newest chat but the content drifted under a burst: pin it back.
      if (atBottom.current && y > 1) listRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    const bottom = y < 20;
    if (bottom !== atBottom.current) {
      atBottom.current = bottom;
      setReading(!bottom);
      if (bottom) setUnread(0);
    }
  }

  function jumpBottom() {
    atBottom.current = true;
    setReading(false);
    setUnread(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  const conn = CONN_META[connState] ?? CONN_META.connecting;
  const isLive = liveStatus === 'OPEN';
  const isEnded = liveStatus === 'CLOSE';
  // One short status, said once. Green only while live; an ended stream gets no dot at all.
  const status: { label: string; dot: 'primarySoft' | 'mute' | 'danger' | null } =
    connState !== 'connected'
      ? { label: conn.label, dot: conn.color }
      : isLive
        ? { label: viewers != null ? `실시간 · ${viewers.toLocaleString()}명 시청 중` : '실시간', dot: 'primarySoft' }
        : isEnded
          ? { label: '방송 종료', dot: null }
          : { label: conn.label, dot: conn.color };

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatRow
        m={item}
        emojiMap={emojiMap}
        onPress={setSelected}
      />
    ),
    [emojiMap],
  );

  function closeProfile() {
    setActionError(null);
    setSelected(null);
    setConfirmBlind(false);
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    // Keep the draft when the socket is between connections instead of silently dropping it.
    if (sendChat(text)) setDraft('');
  }

  function handleMention() {
    if (!selected) return;
    setDraft(`@${selected.nickname} `);
    closeProfile();
  }

  function handleBlind() {
    if (!selected || !chatChannelId || !cookie || !streamingChannelId) return;
    if (!confirmBlind) {
      setConfirmBlind(true);
      return;
    }
    void blindChat({ chatChannelId, streamingChannelId, cookie }, selected)
      .then(closeProfile)
      .catch(() => setActionError('메시지를 가리지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }

  function handlePostNotice() {
    if (!chatChannelId || !cookie || !streamingChannelId || !uid) return;
    const text = noticeDraft.trim();
    if (!text) return;
    void postChatNotice({ chatChannelId, streamingChannelId, cookie }, uid, text)
      .then(() => {
        setActionError(null);
        setComposerOpen(false);
        setNoticeDraft('');
      })
      .catch(() => setActionError('공지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }

  function handleClearNotice() {
    if (!chatChannelId || !cookie || !streamingChannelId || !uid) return;
    void clearChatNotice({ chatChannelId, streamingChannelId, cookie }, uid)
      .then(() => {
        setActionError(null);
        setComposerOpen(false);
      })
      .catch(() => setActionError('공지를 내리지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }

  const bottomPad = Math.max(insets.bottom, Spacing.md);
  const selectedMeta = selected
    ? profileCard?.streamingProperty.subscription
      ? `구독 ${profileCard.streamingProperty.subscription.accumulativeMonth}개월 · ${ROLE_LABEL[selected.role]}`
      : profileCard?.streamingProperty.following
        ? `팔로우 중 · ${ROLE_LABEL[selected.role]}`
        : ROLE_LABEL[selected.role]
    : '';
  const canBlind = canModerate && loggedIn && !!chatChannelId && !!streamingChannelId;

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
            <Pressable
              onPress={() => router.push({ pathname: '/logs/[channelId]', params: { channelId, name } })}
              accessibilityRole="button"
              accessibilityLabel="이 폰에 저장된 지난 채팅 보기"
              hitSlop={4}
              style={({ pressed }) => [
                styles.historyButton,
                { backgroundColor: pressed ? theme.canvasSoft2 : theme.canvasSoft },
              ]}>
              <Icon name="history" color={theme.body} size={16} />
              <Text style={[Type.micro, { color: theme.ink, fontWeight: 600 }]}>지난 채팅</Text>
            </Pressable>
            {canModerate && loggedIn ? (
              <IconButton name="megaphone" label="공지 올리기" color="body" onPress={() => setComposerOpen(true)} />
            ) : null}
          </>
        }>
        <View style={styles.headerMain}>
          <ChannelAvatar uri={image} name={name || '?'} size={34} />
          <View style={styles.headerTitle}>
            <View style={styles.headerTitleRow}>
              <Text style={[Type.bodyStrong, styles.channelName, { color: theme.ink }]} numberOfLines={1}>
                {name}
              </Text>
              {isLive ? <LiveBadge /> : null}
            </View>
            <View style={styles.connRow}>
              {status.dot ? <View style={[styles.connDot, { backgroundColor: theme[status.dot] }]} /> : null}
              <Text style={[Type.micro, { color: theme.body }]} numberOfLines={1}>
                {status.label}
              </Text>
            </View>
          </View>
        </View>
      </ScreenHeader>

      {connState === 'offline' ? (
        <View style={[styles.banner, { backgroundColor: theme.canvasSoft }]}>
          <Text style={[Type.label, styles.bannerText, { color: theme.ink }]}>연결이 끊겼어요</Text>
          <Button label="다시 연결" size="sm" variant="secondary" onPress={retry} />
        </View>
      ) : null}

      {notice ? (
        <Pressable
          onPress={() => setNoticeOpen((v) => !v)}
          accessibilityLabel={noticeOpen ? '공지 접기' : '공지 펼치기'}
          style={[styles.notice, { backgroundColor: theme.canvasSoft }]}>
          <Icon name="megaphone" color={theme.ink} size={18} />
          <Text style={[Type.label, styles.noticeText, { color: theme.ink }]} numberOfLines={noticeOpen ? undefined : 1}>
            {notice}
          </Text>
          <View style={{ transform: [{ rotate: noticeOpen ? '180deg' : '0deg' }] }}>
            <Icon name="down" color={theme.mute} size={16} />
          </View>
        </Pressable>
      ) : null}

      <View style={styles.listArea}>
        {/* ponytail: FlatList (RN core), not FlashList 2 as AGENTS.md rule 5 asks: FlashList 2's
            recycler + maintainVisibleContentPosition misrendered here (blank rows, forced scroll
            to the bottom). Rows are memoized and the list is capped (500 / 2000 while reading).
            Upgrade path: retry FlashList 2 in a dev build with inverted-style chat. */}
        <FlatList
          ref={listRef}
          inverted
          data={data}
          // Content-based key (same identity as the store dedup): an index key would shift on every
          // new message in this reversed list and remount every visible row.
          keyExtractor={chatKey}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={renderItem}
          onScroll={onScroll}
          onScrollBeginDrag={() => {
            userScrolling.current = true;
          }}
          onMomentumScrollBegin={() => {
            userScrolling.current = true;
          }}
          onScrollEndDrag={() => {
            userScrolling.current = false;
          }}
          onMomentumScrollEnd={() => {
            userScrolling.current = false;
          }}
          scrollEventThrottle={16}
          // Bursts of ~30 chats/s: render a smaller window around the viewport so each batch
          // updates fewer cells (default windowSize 21 = ten screens each way).
          windowSize={7}
          maxToRenderPerBatch={8}
          // Scrolled up: keep the row being read in place as new chats land at index 0.
          // Near the newest end (offset < 20): keep following new messages.
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 20 }}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            // Inverted: the header sits at the newest end, in flow, so it never covers a row.
            isEnded && connState === 'connected' && data.length > 0 ? (
              <Text style={[Type.caption, styles.endedNote, { color: theme.body }]}>
                채팅방은 계속 열려 있어요. 새 채팅이 오면 바로 보여요.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {connState === 'unavailable' && adultOnly ? (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: theme.canvasSoft }]}>
                    <Icon name="lock" color={theme.mute} size={24} />
                  </View>
                  <Text style={[Type.bodyStrong, { color: theme.ink }]}>연령 제한 방송이에요</Text>
                  <Text style={[Type.label, styles.emptyHint, { color: theme.mute }]}>
                    {loggedIn
                      ? '성인 인증을 마친 네이버 계정이어야 채팅을 볼 수 있어요.'
                      : '네이버로 로그인하면 채팅을 볼 수 있어요. 성인 인증을 마친 계정이어야 해요.'}
                  </Text>
                  {loggedIn ? null : <Button label="로그인" onPress={() => router.push('/login')} />}
                </>
              ) : connState === 'unavailable' ? (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: theme.canvasSoft }]}>
                    <Icon name="chat" color={theme.mute} size={24} />
                  </View>
                  <Text style={[Type.bodyStrong, { color: theme.ink }]}>이 채널은 채팅을 볼 수 없어요</Text>
                  <Text style={[Type.label, styles.emptyHint, { color: theme.mute }]}>
                    아직 방송한 적이 없거나 채팅이 막혀 있는 채널이에요.
                  </Text>
                </>
              ) : connState === 'connected' ? (
                <>
                  <View style={[styles.emptyIcon, { backgroundColor: theme.canvasSoft }]}>
                    <Icon name="chat" color={theme.mute} size={24} />
                  </View>
                  <Text style={[Type.bodyStrong, { color: theme.ink }]}>아직 채팅이 없어요</Text>
                  <Text style={[Type.label, styles.emptyHint, { color: theme.mute }]}>
                    새 채팅이 올라오면 바로 여기에 보여드릴게요.
                  </Text>
                </>
              ) : (
                <>
                  <ActivityIndicator color={theme.mute} />
                  <Text style={[Type.label, { color: theme.mute }]}>{conn.label}</Text>
                </>
              )}
            </View>
          }
        />

        {unread > 0 ? (
          <View pointerEvents="box-none" style={styles.unreadWrap}>
            <Pressable onPress={jumpBottom} style={[styles.unreadButton, { backgroundColor: theme.ink }]}>
              <Text style={[Type.label, { color: theme.canvas, fontWeight: 700 }]}>
                새 메시지 {unread > 999 ? '999+' : unread}개
              </Text>
              <Icon name="down" color={theme.canvas} size={16} />
            </Pressable>
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
            style={[Type.body, styles.textInput, { backgroundColor: theme.canvasSoft, color: theme.ink }]}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim()}
            accessibilityLabel="보내기"
            style={[styles.sendButton, { backgroundColor: draft.trim() ? theme.primary : theme.canvasSoft2 }]}>
            <Text style={[Type.label, { fontWeight: 700, color: draft.trim() ? theme.onPrimary : theme.mute }]}>전송</Text>
          </Pressable>
        </View>
      ) : !readOnlyHidden ? (
        <View style={[styles.inputBar, { paddingBottom: bottomPad, borderTopColor: theme.hairline }]}>
          <Icon name="lock" color={theme.mute} size={18} />
          <View style={styles.readOnlyText}>
            <Text style={[Type.label, { color: theme.ink, fontWeight: 600 }]}>보기만 하는 중이에요</Text>
            <Text style={[Type.micro, { color: theme.mute, fontWeight: 400 }]}>채팅을 보내려면 로그인해 주세요</Text>
          </View>
          <Button label="로그인" size="sm" onPress={() => router.push('/login')} />
          <IconButton name="close" label="안내 닫기" color="mute" size={18} onPress={() => setReadOnlyHidden(true)} />
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}

      <BottomSheet
        visible={composerOpen}
        onClose={() => {
          setActionError(null);
          setComposerOpen(false);
        }}>
        <View style={styles.sheetBody}>
          <View style={styles.sheetIntro}>
            <Text style={[Type.title, { color: theme.ink }]}>공지 올리기</Text>
            <Text style={[Type.label, { color: theme.mute, fontWeight: 400 }]}>
              채팅창 맨 위에 고정돼서 모든 시청자에게 보여요.
            </Text>
          </View>
          <TextInput
            value={noticeDraft}
            onChangeText={setNoticeDraft}
            placeholder="공지 내용을 입력하세요"
            placeholderTextColor={theme.mute}
            multiline
            style={[Type.body, styles.composerInput, { backgroundColor: theme.canvas, color: theme.ink }]}
          />
          {actionError ? <Text style={[Type.label, { color: theme.danger }]}>{actionError}</Text> : null}
          <View style={styles.sheetActions}>
            {notice ? <Button label="지금 공지 내리기" variant="danger" stretch onPress={handleClearNotice} /> : null}
            <Button label="올리기" stretch onPress={handlePostNotice} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={!!selected} onClose={closeProfile}>
        {selected ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetHead}>
              <ProfileThumb
                uri={selected.profileImageUrl || selectedImage}
                name={selected.nickname || ANONYMOUS_DONOR}
                size={52}
              />
              <View style={styles.sheetTitle}>
                <Text style={[Type.title, { color: theme.ink }]} numberOfLines={1}>
                  {selected.nickname || ANONYMOUS_DONOR}
                </Text>
                <Text style={[Type.caption, { color: theme.mute }]}>{selectedMeta}</Text>
              </View>
            </View>
            {selected.message ? (
              <View style={[styles.sheetMsg, { backgroundColor: theme.canvas }]}>
                <Text style={[Type.body, { color: theme.ink }]}>{selected.message}</Text>
              </View>
            ) : null}
            {actionError ? <Text style={[Type.label, { color: theme.danger }]}>{actionError}</Text> : null}
            <View style={styles.sheetActions}>
              {canBlind ? (
                <Button
                  label={confirmBlind ? '한 번 더 누르면 가려져요' : '메시지 가리기'}
                  variant="danger"
                  stretch
                  onPress={handleBlind}
                />
              ) : null}
              {loggedIn ? (
                <Button label="멘션하기" stretch onPress={handleMention} />
              ) : (
                <Button label="닫기" variant="secondary" stretch onPress={closeProfile} />
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  channelName: { flexShrink: 1 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  connDot: { width: 6, height: 6, borderRadius: Radius.pill },
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  noticeText: { flex: 1, fontWeight: 400 },
  endedNote: { textAlign: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: Spacing.md,
    marginRight: Spacing.xs,
    borderRadius: Radius.pill,
  },
  listArea: { flex: 1 },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingVertical: Spacing.xs },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxxxl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyHint: { textAlign: 'center', fontWeight: 400 },
  unreadWrap: { position: 'absolute', left: 0, right: 0, bottom: Spacing.md, alignItems: 'center' },
  unreadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
  },
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
  sendButton: {
    height: TOUCH,
    paddingHorizontal: Spacing.lg,
    marginRight: Spacing.sm,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: { gap: Spacing.lg },
  sheetIntro: { gap: Spacing.xs },
  composerInput: {
    minHeight: 96,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    textAlignVertical: 'top',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sheetTitle: { flex: 1, gap: 2 },
  sheetMsg: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm },
});
