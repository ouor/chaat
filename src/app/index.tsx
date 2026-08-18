import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLiveStatus } from '@/client/chzzk/rest';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useFavorites, type FavoriteChannel } from '@/store/favorites';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { favorites } = useFavorites();
  const [liveMap, setLiveMap] = useState<Record<string, { open: boolean; viewers: number }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      Promise.allSettled(favorites.map((f) => getLiveStatus(f.channelId))).then((results) => {
        if (cancelled) return;
        const map: Record<string, { open: boolean; viewers: number }> = {};
        favorites.forEach((f, i) => {
          const r = results[i];
          if (r.status === 'fulfilled') {
            map[f.channelId] = { open: r.value.status === 'OPEN', viewers: r.value.concurrentUserCount };
          }
        });
        setLiveMap(map);
        setLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [favorites]);

  const favoritesCount = favorites.length;

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <View style={[styles.logo, { backgroundColor: theme.primary }]} />
        <Text style={[styles.brand, { color: theme.ink }]}>CHZZK Chat</Text>
        <Pressable onPress={() => router.push('/search')} style={styles.headerButton} hitSlop={8}>
          <Icon name="search" color={theme.body} />
        </Pressable>
      </SafeAreaView>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: theme.mute }]}>FAVORITES</Text>
        <Text style={[styles.sectionCount, { color: theme.mute }]}>{favoritesCount} channels</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={[styles.empty, { borderColor: theme.hairline, backgroundColor: theme.canvasSoft }]}>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>No favorites yet</Text>
          <Text style={[styles.emptyHint, { color: theme.mute }]}>
            Add the channels you watch and their chat is one tap away — even after the stream ends.
          </Text>
          <Pressable onPress={() => router.push('/search')} style={[styles.cta, { backgroundColor: theme.primary }]}>
            <Text style={[styles.ctaText, { color: theme.onPrimary }]}>Find channels</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={favorites}
          renderItem={({ item }: { item: FavoriteChannel }) => {
            const live = liveMap[item.channelId];
            const isOpen = live?.open ?? false;
            const sub = live
              ? isOpen
                ? `${live.viewers.toLocaleString()} watching`
                : 'Ended'
              : loading
                ? '…'
                : 'Ended';
            return (
              <Pressable
                onPress={() => router.push(`/chat/${item.channelId}`)}
                style={[styles.row, { borderBottomColor: theme.hairline }]}>
                <View style={[styles.avatar, { borderColor: theme.hairline, backgroundColor: theme.canvasSoft }]}>
                  <Text style={[styles.avatarText, { color: theme.mute }]}>
                    {(item.channelName[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowText}>
                  <View style={styles.rowTitle}>
                    <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                      {item.channelName}
                    </Text>
                    {isOpen ? (
                      <View style={[styles.livePill, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.livePillText, { color: theme.onPrimary }]}>LIVE</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.rowSub, { color: theme.mute }]}>{sub}</Text>
                </View>
                <Text style={{ color: theme.mute, fontSize: 12 }}>›</Text>
              </Pressable>
            );
          }}
          keyExtractor={(item) => item.channelId}
          style={{ flex: 1 }}
        />
      )}

      <Pressable
        onPress={() => router.push('/search')}
        style={[styles.searchBar, { borderColor: theme.hairline, backgroundColor: theme.canvasSoft }]}>
        <Text style={{ color: theme.mute, fontSize: 14 }}>Search channels</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  logo: {
    width: 9,
    height: 16,
    borderRadius: 1,
    transform: [{ skewX: '-12deg' }],
  },
  brand: { flex: 1, fontSize: 17, fontWeight: 600, letterSpacing: -0.3 },
  headerButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: 2.5 },
  sectionCount: { fontSize: 10.5, fontFamily: 'monospace' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: 600 },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowName: { fontSize: 15, fontWeight: 600, flexShrink: 1 },
  livePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.pill,
  },
  livePillText: { fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6 },
  rowSub: { fontSize: 11, fontFamily: 'monospace' },
  empty: {
    margin: Spacing.lg,
    padding: Spacing.xxxl,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: 600 },
  emptyHint: { fontSize: 12.5, lineHeight: 19, textAlign: 'center' },
  cta: {
    marginTop: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  ctaText: { fontSize: 14, fontWeight: 600 },
  searchBar: {
    height: 44,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
});
