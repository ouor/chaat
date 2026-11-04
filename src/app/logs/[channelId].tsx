import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmojiText } from '@/components/chat/emoji-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { Tag } from '@/components/ui/tag';
import { Text } from '@/components/ui/text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { BLINDED_TEXT, displayNickname } from '@/constants/chat-text';
import { Radius, Size, Spacing, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { hhmm } from '@/lib/time';
import { useAuth } from '@/store/auth-context';
import { useEmojiMap } from '@/store/emoji-map';
import { useFavorites } from '@/store/favorites';
import { exportChatLogs, getLogs, LOG_LIMIT, type LogRow } from '@/store/chat-logs';

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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  // The name param can come from a deep link; prefer what the app already knows about the channel.
  const title = favorites.find((f) => f.channelId === channelId)?.channelName || name || '지난 채팅';
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

  // Exports what the list shows: the whole archive, or only the chats matching the search.
  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      await exportChatLogs(channelId, title, debouncedQuery);
    } catch (e) {
      // The reason only (no chat content): without it an export failure leaves nothing to go on.
      console.warn('[export] failed:', e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e));
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };
  const searching = debouncedQuery.trim() !== '';

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <ScreenHeader
        title={title}
        subtitle={rangeLabel(rows)}
        right={
          hasAny ? (
            <Button
              label="내보내기"
              size="chip"
              variant="tonal"
              icon="export"
              busy={exporting}
              disabled={rows.length === 0}
              accessibilityLabel={searching ? '찾은 채팅을 CSV 파일로 내보내기' : '저장된 채팅을 CSV 파일로 내보내기'}
              onPress={onExport}
            />
          ) : null
        }
      />

      {exportError ? (
        <Text variant="micro" tone="danger" style={styles.exportError}>
          파일을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </Text>
      ) : null}

      {hasAny ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="채팅 내용이나 닉네임으로 찾기"
          style={styles.search}
        />
      ) : null}

      {hasAny && searching && rows.length > 0 ? (
        <Text variant="micro" tone="mute" style={styles.scopeNote}>
          내보내기를 누르면 찾은 채팅만 파일로 저장돼요
        </Text>
      ) : null}

      {loading ? (
        <EmptyState loading />
      ) : !hasAny ? (
        <EmptyState
          icon="history"
          title="아직 저장된 채팅이 없어요"
          hint={'이 채널의 채팅방을 열어 두면\n그때부터 채팅이 이 폰에 자동으로 저장돼요.'}>
          <Button label="보관 기간 설정" variant="secondary" onPress={() => router.push('/settings')} />
        </EmptyState>
      ) : (
        // shortcut: FlatList like the chat room (see the note there); capped at LOG_LIMIT rows.
        <FlatList
          inverted
          data={entries}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View style={styles.groupHeader}>
                <View style={[styles.groupPill, { backgroundColor: theme.surface }]}>
                  <Text variant="micro" tone="body">{item.label}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Text variant="micro" tone="mute" style={styles.rowTime}>{hhmm(item.row.msg_time)}</Text>
                <View style={styles.rowBody}>
                  <View style={styles.rowNickLine}>
                    {item.row.type === 'donation' ? <Tag label="후원" tone="accent" /> : null}
                    <Text variant="captionStrong" tone="body" style={styles.rowNick} numberOfLines={1}>
                      {displayNickname(item.row.nickname, item.row.type)}
                    </Text>
                  </View>
                  {item.row.type === 'blinded' ? (
                    <Text variant="body" tone="mute">{BLINDED_TEXT}</Text>
                  ) : (
                    <EmojiText
                      text={item.row.message}
                      emojiMap={emojiMap}
                      messageEmojis={item.row.emojis}
                      fontSize={Type.body.fontSize}
                      color={theme.ink}
                    />
                  )}
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
              <Text variant="micro" tone="mute" style={styles.limitNote}>
                최근 {LOG_LIMIT.toLocaleString()}개까지 보여요. 더 오래된 채팅은 검색으로 찾아보세요.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState hint={`‘${debouncedQuery.trim()}’ 이(가) 들어간 채팅이 없어요`} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { marginHorizontal: Spacing.lg, marginTop: Spacing.xs, marginBottom: Spacing.sm },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingVertical: Spacing.sm },
  groupHeader: { alignItems: 'center', paddingVertical: Spacing.md },
  groupPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.tight,
  },
  // Centers the small time on the first line of the larger body text.
  rowTime: {
    width: Size.timeColumn,
    paddingTop: (Type.body.lineHeight - Type.micro.lineHeight) / 2,
    fontVariant: ['tabular-nums'],
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowNickLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.tight },
  rowNick: { flexShrink: 1 },
  scopeNote: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  exportError: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  limitNote: { textAlign: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
});
