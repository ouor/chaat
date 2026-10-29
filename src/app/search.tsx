import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchChannels } from '@/store/channel';
import type { SearchChannel } from '@/client/chzzk/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { LiveBadge } from '@/components/ui/live-badge';
import { SearchField } from '@/components/ui/search-field';
import { Tag } from '@/components/ui/tag';
import { Text } from '@/components/ui/text';
import { Opacity, Radius, Size, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { toggleFavorite, useFavorites } from '@/store/favorites';
import { addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch } from '@/store/recents';

const PAGE_SIZE = 20;
// Search returns every channel whose name matches, including empty look-alikes of a real
// streamer. Channels under this many followers (and not live / verified) fold behind a button.
const SMALL_CHANNEL_FOLLOWERS = 10;

function formatFollowers(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만`;
  return n.toLocaleString();
}

function isSmall(item: SearchChannel): boolean {
  const ch = item.channel;
  return ch.followerCount < SMALL_CHANNEL_FOLLOWERS && !ch.openLive && !ch.verifiedMark;
}

export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const favorites = useFavorites();

  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchChannel[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showSmall, setShowSmall] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);

  const query = q.trim();

  useFocusEffect(
    useCallback(() => {
      setRecents(getRecentSearches());
    }, []),
  );

  // Bumped whenever the result list is replaced (new query or retry), so a "load more" page
  // that was in flight for the previous list is dropped instead of appended to the new one.
  const listGen = useRef(0);

  useEffect(() => {
    listGen.current += 1;
    if (!query) {
      const t = setTimeout(() => {
        setResults([]);
        setNextOffset(null);
        setFailed(false);
      }, 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setInitialLoading(true);
      setFailed(false);
      setShowSmall(false);
      searchChannels(query, { size: PAGE_SIZE })
        .then((res) => {
          if (cancelled) return;
          setResults(res.data);
          setNextOffset(res.nextOffset);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setInitialLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, attempt]);

  function loadMore() {
    if (!query || !nextOffset || loadingMore || initialLoading) return;
    setLoadingMore(true);
    const gen = listGen.current;
    searchChannels(query, { size: PAGE_SIZE, offset: nextOffset })
      .then((res) => {
        if (gen !== listGen.current) return;
        setResults((prev) => [...prev, ...res.data]);
        setNextOffset(res.nextOffset);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }

  const { main, small } = useMemo(() => {
    const m: SearchChannel[] = [];
    const s: SearchChannel[] = [];
    for (const r of results) (isSmall(r) ? s : m).push(r);
    return { main: m, small: s };
  }, [results]);
  // With nothing big enough to show, small channels are the answer, not noise.
  const smallVisible = showSmall || main.length === 0;
  const data = smallVisible ? [...main, ...small] : main;

  const favIds = new Set(favorites.map((f) => f.channelId));

  function openChannel(channelId: string) {
    if (query) setRecents(addRecentSearch(query));
    router.push(`/chat/${channelId}`);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <IconButton name="back" label="뒤로" onPress={() => router.back()} />
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="채널 이름으로 검색"
          autoFocus
          onSubmitEditing={() => query && setRecents(addRecentSearch(query))}
          style={styles.search}
        />
      </SafeAreaView>

      {query ? (
        <FlatList
          data={data}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => {
            const ch = item.channel;
            const fav = favIds.has(ch.channelId);
            const dim = isSmall(item);
            return (
              <View style={styles.row}>
                <Pressable
                  onPress={() => openChannel(ch.channelId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${ch.channelName} 채팅 열기`}
                  style={({ pressed }) => [
                    styles.rowMain,
                    pressed && { backgroundColor: theme.surface },
                    dim && styles.dim,
                  ]}>
                  <Avatar uri={ch.channelImageUrl} name={ch.channelName} size="md" />
                  <View style={styles.rowText}>
                    <View style={styles.rowTitle}>
                      <Text variant="bodyStrong" style={styles.rowName} numberOfLines={1}>
                        {ch.channelName}
                      </Text>
                      {ch.verifiedMark ? <Tag label="인증" /> : null}
                      {ch.openLive ? <LiveBadge /> : null}
                    </View>
                    <Text variant="caption" tone="mute">
                      팔로워 {formatFollowers(ch.followerCount)}명
                    </Text>
                  </View>
                </Pressable>
                <IconButton
                  name={fav ? 'starFilled' : 'star'}
                  label={fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}
                  color={fav ? 'ink' : 'mute'}
                  onPress={() =>
                    toggleFavorite({ channelId: ch.channelId, channelName: ch.channelName, channelImageUrl: ch.channelImageUrl })
                  }
                />
              </View>
            );
          }}
          keyExtractor={(item) => item.channel.channelId}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            data.length > 0 ? (
              <Text variant="caption" tone="mute" style={styles.listHint}>
                ☆ 을 누르면 홈에 즐겨찾기로 저장돼요
              </Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={theme.mute} style={styles.footerSpinner} />
            ) : !smallVisible && small.length > 0 ? (
              <View style={styles.more}>
                <Button label={`팔로워가 적은 채널 ${small.length}개 더 보기`} variant="tonal" onPress={() => setShowSmall(true)} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            initialLoading ? (
              <EmptyState loading />
            ) : failed ? (
              <EmptyState title="검색하지 못했어요" hint="인터넷 연결을 확인하고 다시 시도해 주세요.">
                <Button label="다시 시도" variant="secondary" onPress={() => setAttempt((a) => a + 1)} />
              </EmptyState>
            ) : (
              <EmptyState title={`‘${query}’ 채널이 없어요`} hint="맞춤법을 확인하거나 다른 이름으로 검색해 보세요." />
            )
          }
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.idle}>
          {recents.length > 0 ? (
            <>
              <View style={styles.recentHeader}>
                <Text variant="heading">최근 검색</Text>
                <Pressable
                  onPress={() => {
                    clearRecentSearches();
                    setRecents([]);
                  }}
                  hitSlop={12}>
                  <Text variant="label" tone="mute">전체 삭제</Text>
                </Pressable>
              </View>
              <View style={styles.recentWrap}>
                {recents.map((r) => (
                  <View key={r} style={[styles.recentChip, { backgroundColor: theme.surface }]}>
                    <Pressable onPress={() => setQ(r)} style={styles.recentLabel}>
                      <Text variant="label">{r}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setRecents(removeRecentSearch(r))}
                      hitSlop={8}
                      accessibilityLabel={`${r} 검색 기록 지우기`}
                      style={styles.recentRemove}>
                      <Icon name="close" color={theme.mute} size="sm" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.guide}>
              <Text variant="bodyStrong">어떤 채널을 찾으세요?</Text>
              <Text variant="labelRegular" tone="mute">
                스트리머 이름이나 채널 이름을 입력해 보세요.{'\n'}방송 중이 아니어도 채팅을 볼 수 있어요.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingLeft: Spacing.xs,
    paddingRight: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  search: { flex: 1 },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: Spacing.xxl },
  listHint: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.sm },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  dim: { opacity: Opacity.dim },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.xxs },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowName: { flexShrink: 1 },
  footerSpinner: { paddingVertical: Spacing.xl },
  more: { marginHorizontal: Spacing.xl, marginTop: Spacing.md },
  idle: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  recentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  recentChip: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, height: Size.chip },
  recentLabel: { paddingLeft: Spacing.lg, paddingRight: Spacing.xs, height: Size.chip, justifyContent: 'center' },
  recentRemove: { paddingLeft: Spacing.xs, paddingRight: Spacing.md, height: Size.chip, justifyContent: 'center' },
  guide: { gap: Spacing.sm, paddingTop: Spacing.sm },
});
