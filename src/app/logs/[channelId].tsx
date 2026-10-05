import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ANONYMOUS_DONOR } from '@/components/chat/chat-row';
import { EmojiText } from '@/components/chat/emoji-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { useEmojiMap } from '@/store/emoji-map';
import { useFavorites } from '@/store/favorites';
import { getLogs, LOG_LIMIT, type LogRow } from '@/storage/log-repo';

type Entry =
  | { kind: 'header'; label: string }
  | { kind: 'row'; row: LogRow };

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function shortDate(ms: number, now = new Date()): string {
  const d = new Date(ms);
  const year = d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()}년 `;
  return `${year}${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** Always the real date; 오늘/어제 is added, never a replacement for it. */
function dayLabel(ms: number, now = new Date()): string {
  const d = new Date(ms);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const date = `${shortDate(ms, now)} (${WEEKDAYS[d.getDay()]})`;
  if (diff === 0) return `오늘 · ${date}`;
  if (diff === 1) return `어제 · ${date}`;
  return date;
}

/** Header subtitle: the loaded date range, so the date is visible without scrolling to the top. */
function rangeLabel(rowsOldestFirst: LogRow[]): string {
  if (rowsOldestFirst.length === 0) return '이 폰에 저장된 지난 채팅';
  const first = shortDate(rowsOldestFirst[0].msg_time);
  const last = shortDate(rowsOldestFirst[rowsOldestFirst.length - 1].msg_time);
  return `저장된 채팅 · ${first === last ? first : `${first} ~ ${last}`}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Newest-first entries for an inverted list: each day's header follows its oldest row. */
function groupByDate(rowsOldestFirst: LogRow[]): Entry[] {
  const out: Entry[] = [];
  let last: string | null = null;
  for (const row of rowsOldestFirst) {
    const label = dayLabel(row.msg_time);
    if (label !== last) {
      out.push({ kind: 'header', label });
      last = label;
    }
    out.push({ kind: 'row', row });
  }
  return out.reverse();
}

export default function LogsScreen() {
  const { channelId, name } = useLocalSearchParams<{ channelId: string; name?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const favorites = useFavorites();
  const { cookie } = useAuth();
  const emojiMap = useEmojiMap(channelId, cookie);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hasAny, setHasAny] = useState(false);

  const title = name || favorites.find((f) => f.channelId === channelId)?.channelName || '지난 채팅';
  const entries = useMemo(() => groupByDate(rows), [rows]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Search runs in SQL so it covers the whole archive, not just the rows loaded on screen.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getLogs(channelId, debouncedQuery)
        .then((r) => {
          if (cancelled) return;
          setRows(r);
          if (!debouncedQuery.trim()) setHasAny(r.length > 0);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [channelId, debouncedQuery]),
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <ScreenHeader title={title} subtitle={rangeLabel(rows)} />

      {hasAny ? (
        <View style={[styles.searchWrap, { backgroundColor: theme.canvasSoft }]}>
          <Icon name="search" color={theme.mute} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="채팅 내용이나 닉네임으로 찾기"
            placeholderTextColor={theme.mute}
            returnKeyType="search"
            style={[Type.body, styles.searchInput, { color: theme.ink }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="검색어 지우기">
              <View style={[styles.clear, { backgroundColor: theme.canvasSoft2 }]}>
                <Icon name="close" color={theme.body} size={12} />
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.mute} />
        </View>
      ) : !hasAny ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.canvasSoft }]}>
            <Icon name="history" color={theme.mute} size={26} />
          </View>
          <Text style={[Type.bodyStrong, { color: theme.ink }]}>아직 저장된 채팅이 없어요</Text>
          <Text style={[Type.label, styles.emptyHint, { color: theme.mute }]}>
            이 채널의 채팅방을 열어 두면{'\n'}그때부터 채팅이 이 폰에 자동으로 저장돼요.
          </Text>
          <Button label="보관 기간 설정" variant="secondary" onPress={() => router.push('/settings')} />
        </View>
      ) : (
        <FlatList
          inverted
          data={entries}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View style={styles.groupHeader}>
                <View style={[styles.groupPill, { backgroundColor: theme.canvasSoft }]}>
                  <Text style={[Type.micro, { color: theme.body }]}>{item.label}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={[Type.micro, styles.rowTime, { color: theme.mute }]}>{fmtTime(item.row.msg_time)}</Text>
                <View style={styles.rowBody}>
                  <View style={styles.rowNickLine}>
                    {item.row.type === 'donation' ? (
                      <View style={[styles.donoTag, { backgroundColor: theme.primaryTint }]}>
                        <Text style={[Type.badge, { color: theme.primarySoft }]}>후원</Text>
                      </View>
                    ) : null}
                    <Text style={[Type.caption, styles.rowNick, { color: theme.body }]} numberOfLines={1}>
                      {item.row.nickname || (item.row.type === 'donation' ? ANONYMOUS_DONOR : '익명')}
                    </Text>
                  </View>
                  <EmojiText
                    text={item.row.message}
                    emojiMap={emojiMap}
                    messageEmojis={item.row.emojis}
                    fontSize={Type.body.fontSize}
                    color={theme.ink}
                  />
                </View>
              </View>
            )
          }
          keyExtractor={(item, index) => (item.kind === 'header' ? `h${index}` : `r${index}`)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          ListFooterComponent={
            // Inverted: the footer sits at the visual top, above the oldest loaded day.
            rows.length >= LOG_LIMIT ? (
              <Text style={[Type.micro, styles.limitNote, { color: theme.mute }]}>
                최근 {LOG_LIMIT.toLocaleString()}개까지 보여요. 더 오래된 채팅은 검색으로 찾아보세요.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[Type.label, { color: theme.mute }]}>‘{debouncedQuery.trim()}’ 이(가) 들어간 채팅이 없어요</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: TOUCH,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  searchInput: { flex: 1, height: TOUCH, paddingVertical: 0 },
  clear: { width: 20, height: 20, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingVertical: Spacing.sm },
  groupHeader: { alignItems: 'center', paddingVertical: Spacing.md },
  groupPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  rowTime: { width: 38, paddingTop: 3, fontVariant: ['tabular-nums'] },
  rowBody: { flex: 1, minWidth: 0 },
  rowNickLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowNick: { flexShrink: 1, fontWeight: 600 },
  donoTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radius.xs },
  limitNote: { textAlign: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxxxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyHint: { textAlign: 'center', fontWeight: 400, marginBottom: Spacing.sm },
});
