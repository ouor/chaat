import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchChannels, type SearchResult } from '@/client/chzzk/rest';
import type { SearchChannel } from '@/client/chzzk/types';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { toggleFavorite, useFavorites } from '@/store/favorites';

const PAGE_SIZE = 20;

function formatFollowers(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만`;
  return n.toLocaleString();
}

export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { favorites, refresh } = useFavorites();

  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchChannel[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef<FlatList<SearchChannel>>(null);

  const query = q.trim();

  useEffect(() => {
    if (!query) {
      const t = setTimeout(() => {
        setResults([]);
        setNextOffset(null);
      }, 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setInitialLoading(true);
      searchChannels(query, { size: PAGE_SIZE })
        .then((res: SearchResult) => {
          if (cancelled) return;
          setResults(res.data);
          setNextOffset(res.nextOffset);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setInitialLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function loadMore() {
    if (!query || !nextOffset || loadingMore || initialLoading) return;
    setLoadingMore(true);
    searchChannels(query, { size: PAGE_SIZE, offset: nextOffset })
      .then((res: SearchResult) => {
        setResults((prev) => [...prev, ...res.data]);
        setNextOffset(res.nextOffset);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }

  const favIds = new Set(favorites.map((f) => f.channelId));

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Icon name="back" color={theme.body} />
        </Pressable>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Channel name"
          placeholderTextColor={theme.mute}
          autoFocus
          style={[
            styles.input,
            { backgroundColor: theme.canvasSoft, borderColor: theme.hairline, color: theme.ink },
          ]}
        />
      </SafeAreaView>

      {query ? (
        <FlatList
          ref={listRef}
          data={results}
          renderItem={({ item }) => {
            const ch = item.channel;
            const fav = favIds.has(ch.channelId);
            return (
              <View style={[styles.row, { borderBottomColor: theme.hairline }]}>
                <Pressable
                  onPress={() => router.push(`/chat/${ch.channelId}`)}
                  style={styles.rowMain}
                  hitSlop={4}>
                  <View style={[styles.avatar, { borderColor: theme.hairline, backgroundColor: theme.canvasSoft }]}>
                    <Text style={[styles.avatarText, { color: theme.mute }]}>
                      {(ch.channelName[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.rowText}>
                    <View style={styles.rowTitle}>
                      <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                        {ch.channelName}
                      </Text>
                      {ch.openLive ? (
                        <View style={[styles.livePill, { backgroundColor: theme.primary }]}>
                          <Text style={[styles.livePillText, { color: theme.onPrimary }]}>LIVE</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.rowSub, { color: theme.mute }]}>
                      {formatFollowers(ch.followerCount)} followers
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    toggleFavorite({ channelId: ch.channelId, channelName: ch.channelName, channelImageUrl: ch.channelImageUrl });
                    refresh();
                  }}
                  style={styles.starButton}
                  hitSlop={8}>
                  <Text style={{ color: fav ? theme.primary : theme.mute, fontSize: 18 }}>{fav ? '★' : '☆'}</Text>
                </Pressable>
              </View>
            );
          }}
          keyExtractor={(item) => item.channel.channelId}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              {initialLoading ? (
                <Text style={{ color: theme.mute }}>Searching…</Text>
              ) : (
                <>
                  <Text style={[styles.emptyTitle, { color: theme.ink }]}>No channels found</Text>
                  <Text style={[styles.emptyHint, { color: theme.mute }]}>
                    Check the spelling, or try the channel&apos;s Korean name.
                  </Text>
                </>
              )}
            </View>
          }
        />
      ) : (
        <View style={[styles.empty, { backgroundColor: theme.canvas }]}>
          <Text style={{ color: theme.mute }}>Type a channel name to search</Text>
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
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: { width: 30, height: 32, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    height: 38,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: 14,
  },
  listContent: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: 600 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowName: { fontSize: 14.5, fontWeight: 600, flexShrink: 1 },
  livePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.pill,
  },
  livePillText: { fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6 },
  rowSub: { fontSize: 10.5, fontFamily: 'monospace' },
  starButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40, paddingTop: 100 },
  emptyTitle: { fontSize: 14.5, fontWeight: 600 },
  emptyHint: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
});
