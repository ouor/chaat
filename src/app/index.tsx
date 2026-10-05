import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getLiveStatus } from '@/client/chzzk/rest';
import { ChannelAvatar } from '@/components/channel/channel-avatar';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { LiveBadge } from '@/components/ui/live-badge';
import { Radius, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useFavorites, type FavoriteChannel } from '@/store/favorites';

type Live = { open: boolean; viewers: number } | { failed: true };

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'chat', title: '채팅만 가볍게', body: '영상은 큰 화면으로 보고, 채팅은 폰으로 편하게 보세요.' },
  { icon: 'moon', title: '방송이 끝나도 그대로', body: '방송이 끝난 뒤에도 채팅방이 닫히지 않아요.' },
  {
    icon: 'phone',
    title: '내 폰에 자동 저장',
    body: '본 채팅은 폰에 남아요. 내 채팅이나 후원이 읽혔는지 나중에 다시 확인할 수 있어요.',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const favorites = useFavorites();
  const [liveMap, setLiveMap] = useState<Record<string, Live>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadStatuses = useCallback(() => {
    Promise.allSettled(favorites.map((f) => getLiveStatus(f.channelId))).then((results) => {
      const map: Record<string, Live> = {};
      favorites.forEach((f, i) => {
        const r = results[i];
        map[f.channelId] =
          r.status === 'fulfilled'
            ? { open: r.value.status === 'OPEN', viewers: r.value.concurrentUserCount }
            : { failed: true };
      });
      setLiveMap(map);
      setRefreshing(false);
    });
  }, [favorites]);

  useEffect(() => {
    const t = setTimeout(loadStatuses, 0);
    return () => clearTimeout(t);
  }, [loadStatuses]);

  // Live channels first (most viewers on top); the rest keep the order they were added in.
  const sorted = useMemo(() => {
    const viewers = (f: FavoriteChannel) => {
      const l = liveMap[f.channelId];
      return l && 'open' in l && l.open ? l.viewers + 1 : 0;
    };
    return [...favorites].sort((a, b) => viewers(b) - viewers(a));
  }, [favorites, liveMap]);

  const liveCount = sorted.filter((f) => {
    const l = liveMap[f.channelId];
    return l && 'open' in l && l.open;
  }).length;

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.brandWrap}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]} />
          <Text style={[Type.title, { color: theme.ink }]}>chaat</Text>
        </View>
        <IconButton name="gear" label="설정" onPress={() => router.push('/settings')} />
      </SafeAreaView>

      {favorites.length === 0 ? (
        <>
          <ScrollView contentContainerStyle={styles.onboard}>
            <Text style={[Type.hero, { color: theme.ink }]}>
              방송이 끝나도{'\n'}채팅은 그대로 남아요
            </Text>
            <Text style={[Type.body, styles.onboardSub, { color: theme.body }]}>
              치지직 채팅만 가볍게 보는 앱이에요.{'\n'}로그인 없이 바로 볼 수 있어요.
            </Text>
            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.feature}>
                  <View style={[styles.featureIcon, { backgroundColor: theme.canvasSoft }]}>
                    <Icon name={f.icon} color={theme.ink} size={22} />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={[Type.bodyStrong, { color: theme.ink }]}>{f.title}</Text>
                    <Text style={[Type.label, { color: theme.mute, fontWeight: 400 }]}>{f.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <SafeAreaView edges={['bottom']} style={styles.footer}>
            <Text style={[Type.caption, styles.footerHint, { color: theme.mute }]}>
              자주 보는 채널을 즐겨찾기하면 여기에 모여요
            </Text>
            <Button label="보고 싶은 채널 찾기" size="lg" onPress={() => router.push('/search')} />
          </SafeAreaView>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => router.push('/search')}
            accessibilityRole="search"
            style={({ pressed }) => [
              styles.searchBar,
              { backgroundColor: pressed ? theme.canvasSoft2 : theme.canvasSoft },
            ]}>
            <Icon name="search" color={theme.mute} size={20} />
            <Text style={[Type.body, { color: theme.mute }]}>채널 이름으로 검색</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={[Type.heading, { color: theme.ink }]}>즐겨찾기</Text>
            <Text style={[Type.label, { color: theme.mute }]}>
              {liveCount > 0 ? `${favorites.length}개 중 ${liveCount}개 방송 중` : `${favorites.length}개`}
            </Text>
          </View>

          <FlashList
            data={sorted}
            extraData={liveMap}
            onRefresh={() => {
              setRefreshing(true);
              loadStatuses();
            }}
            refreshing={refreshing}
            renderItem={({ item }: { item: FavoriteChannel }) => {
              const live = liveMap[item.channelId];
              const isOpen = !!live && 'open' in live && live.open;
              const sub = !live
                ? '방송 상태 확인 중…'
                : 'failed' in live
                  ? '방송 상태를 불러오지 못했어요'
                  : live.open
                    ? `${live.viewers.toLocaleString()}명 시청 중`
                    : '방송 종료 · 채팅은 볼 수 있어요';
              return (
                <Pressable
                  onPress={() => router.push(`/chat/${item.channelId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.channelName} 채팅 열기`}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.canvasSoft }]}>
                  <ChannelAvatar uri={item.channelImageUrl} name={item.channelName} size={48} />
                  <View style={styles.rowText}>
                    <View style={styles.rowTitle}>
                      <Text style={[Type.bodyStrong, styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                        {item.channelName}
                      </Text>
                      {isOpen ? <LiveBadge /> : null}
                    </View>
                    <Text style={[Type.caption, { color: isOpen ? theme.primarySoft : theme.mute }]}>{sub}</Text>
                  </View>
                  <Icon name="chevron" color={theme.mute} size={18} />
                </Pressable>
              );
            }}
            keyExtractor={(item) => item.channelId}
            style={styles.list}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  brandWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: {
    width: 9,
    height: 18,
    borderRadius: 1,
    transform: [{ skewX: '-12deg' }],
  },
  onboard: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxxl, paddingBottom: Spacing.xxl },
  onboardSub: { marginTop: Spacing.md },
  features: { marginTop: Spacing.xxxxl, gap: Spacing.xxl },
  feature: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start' },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, gap: 2, paddingTop: 2 },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  footerHint: { textAlign: 'center', marginBottom: Spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: TOUCH + 4,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.sm,
  },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowName: { flexShrink: 1 },
});
