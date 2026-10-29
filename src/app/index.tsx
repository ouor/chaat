import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatPreview } from '@/components/chat/chat-preview';
import { Avatar } from '@/components/ui/avatar';
import { Brand } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { IconTile } from '@/components/ui/icon-tile';
import { LiveBadge } from '@/components/ui/live-badge';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TOUCH } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { loadLiveSummaries, type LiveSummary } from '@/store/channel';
import { useFavorites, type FavoriteChannel } from '@/store/favorites';

type Live = LiveSummary;

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'chat', title: '채팅만 가볍게', body: '영상은 큰 화면으로 보고, 채팅은 폰으로 편하게 보세요.' },
  { icon: 'moon', title: '방송이 끝나도 그대로', body: '방송이 끝난 뒤에도 채팅방이 닫히지 않아요.' },
  {
    icon: 'phone',
    title: '내 폰에 자동 저장',
    body: '채팅방을 열어 둔 동안의 채팅이 폰에 저장돼요. 방송이 끝난 뒤에도 내가 쓴 채팅을 다시 찾아볼 수 있어요.',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const favorites = useFavorites();
  const [liveMap, setLiveMap] = useState<Record<string, Live>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadStatuses = useCallback(() => {
    void loadLiveSummaries(favorites.map((f) => f.channelId)).then((map) => {
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
          <Brand />
        </View>
        <IconButton name="gear" label="설정" onPress={() => router.push('/settings')} />
      </SafeAreaView>

      {favorites.length === 0 ? (
        <>
          <ScrollView contentContainerStyle={styles.onboard}>
            <Text variant="hero">
              방송이 끝나도{'\n'}채팅은 그대로 남아요
            </Text>
            <Text variant="body" tone="body" style={styles.onboardSub}>
              치지직 채팅만 가볍게 보는 앱이에요.{'\n'}로그인 없이 바로 볼 수 있어요.
            </Text>
            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.feature}>
                  <IconTile name={f.icon} size="lg" shape="rounded" />
                  <View style={styles.featureText}>
                    <Text variant="bodyStrong">{f.title}</Text>
                    <Text variant="labelRegular" tone="mute">{f.body}</Text>
                  </View>
                </View>
              ))}
            </View>
            <ChatPreview label="채팅은 이렇게 보여요" surface="surface" />
          </ScrollView>
          <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: theme.canvas }]}>
            <Text variant="caption" tone="mute" style={styles.footerHint}>
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
              { backgroundColor: pressed ? theme.surfaceRaised : theme.surface },
            ]}>
            <Icon name="search" color={theme.mute} size="md" />
            <Text variant="body" tone="mute">채널 이름으로 검색</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text variant="heading">즐겨찾기</Text>
            <Text variant="label" tone="mute">
              {liveCount > 0 ? `${favorites.length}개 중 ${liveCount}개 방송 중` : `${favorites.length}개`}
            </Text>
          </View>

          <FlashList
            data={sorted}
            extraData={liveMap}
            // FlashList 2 keeps the visible item anchored by default. When live statuses arrive and
            // a live channel moves to the top, that anchored the old first row and pushed the new
            // first one above the screen (opened scrolled to the second channel). A favorites list
            // re-sorted from the top should just stay at the top.
            maintainVisibleContentPosition={{ disabled: true }}
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
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surface }]}>
                  <Avatar uri={item.channelImageUrl} name={item.channelName} size="md" />
                  <View style={styles.rowText}>
                    <View style={styles.rowTitle}>
                      <Text variant="bodyStrong" style={styles.rowName} numberOfLines={1}>
                        {item.channelName}
                      </Text>
                      {isOpen ? <LiveBadge /> : null}
                    </View>
                    <Text variant="caption" tone={isOpen ? 'accentText' : 'mute'}>
                      {sub}
                    </Text>
                  </View>
                  <Icon name="chevron" color={theme.mute} size="md" />
                </Pressable>
              );
            }}
            keyExtractor={(item) => item.channelId}
            ListFooterComponent={
              <View style={[styles.tip, { backgroundColor: theme.surface }]}>
                <IconTile name="history" surface="surfaceRaised" />
                <View style={styles.tipText}>
                  <Text variant="labelStrong">방송이 끝나도 들어가 보세요</Text>
                  <Text variant="caption" tone="mute">
                    채팅방은 계속 열려 있어요. 채팅방 오른쪽 위 ‘지난 채팅’에서 저장된 채팅도 다시 볼 수 있어요.
                  </Text>
                </View>
              </View>
            }
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
  onboard: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  onboardSub: { marginTop: Spacing.md },
  features: { marginTop: Spacing.xxxl, marginBottom: Spacing.xxl, gap: Spacing.xl },
  feature: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start' },
  featureText: { flex: 1, gap: Spacing.xxs, paddingTop: Spacing.xxs },
  footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  footerHint: { textAlign: 'center', marginBottom: Spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: TOUCH,
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
  tip: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
  },
  tipText: { flex: 1, gap: Spacing.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.xxs },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowName: { flexShrink: 1 },
});
