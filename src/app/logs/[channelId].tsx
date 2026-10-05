import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { getLogs, type LogRow } from '@/storage/log-repo';

type Entry =
  | { kind: 'header'; label: string }
  | { kind: 'row'; row: LogRow };

function localDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function groupByDate(rows: LogRow[]): Entry[] {
  const out: Entry[] = [];
  let last: string | null = null;
  for (const row of rows) {
    const key = localDateKey(row.msg_time);
    if (key !== last) {
      out.push({ kind: 'header', label: key });
      last = key;
    }
    out.push({ kind: 'row', row });
  }
  return out;
}

export default function LogsScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hasAny, setHasAny] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Search runs in SQL so it covers the whole archive, not just the rows loaded on screen.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getLogs(channelId, debouncedQuery)
        .then((rows) => {
          if (cancelled) return;
          setEntries(groupByDate(rows));
          if (!debouncedQuery.trim()) setHasAny(rows.length > 0);
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
    <View style={[styles.root, { backgroundColor: theme.canvasSoft }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.canvas, borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Icon name="back" color={theme.body} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={[styles.archiveLabel, { color: theme.mute }]}>ARCHIVE</Text>
          <Text style={[styles.channelName, { color: theme.ink }]} numberOfLines={1}>
            {channelId}
          </Text>
        </View>
      </SafeAreaView>

      <View style={[styles.banner, { backgroundColor: theme.canvasSoft2, borderBottomColor: theme.hairline }]}>
        <Text style={[styles.bannerText, { color: theme.mute }]}>READ-ONLY · SAVED ON THIS DEVICE</Text>
      </View>

      {hasAny ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search messages or nicknames"
          placeholderTextColor={theme.mute}
          style={[
            styles.searchInput,
            { backgroundColor: theme.canvasSoft, borderColor: theme.hairline, color: theme.ink },
          ]}
        />
      ) : null}

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: theme.mute }}>Loading…</Text>
        </View>
      ) : !hasAny ? (
        <View style={[styles.emptyCard, { borderColor: theme.hairline }]}>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>Nothing saved yet</Text>
          <Text style={[styles.emptyHint, { color: theme.mute }]}>
            Logging starts the first time you open this channel&apos;s chat. Retention is set in Settings.
          </Text>
          <Pressable onPress={() => router.push('/settings')} style={[styles.settingsButton, { borderColor: theme.hairline }]}>
            <Text style={{ color: theme.ink, fontSize: 13, fontWeight: 600 }}>Log settings</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View style={[styles.groupHeader, { backgroundColor: theme.canvas, borderBottomColor: theme.hairline }]}>
                <Text style={[styles.groupLabel, { color: theme.primarySoft }]}>{item.label}</Text>
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={[styles.rowTime, { color: theme.mute }]}>{fmtTime(item.row.msg_time)}</Text>
                <Text style={[styles.rowNick, { color: theme.mute }]} numberOfLines={1}>
                  {item.row.nickname}
                </Text>
                <Text style={[styles.rowText, { color: theme.body }]}>{item.row.message}</Text>
              </View>
            )
          }
          keyExtractor={(item, index) => (item.kind === 'header' ? `h${index}` : `r${index}`)}
          style={{ flex: 1 }}
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.empty}>
                <Text style={{ color: theme.mute }}>No matching messages</Text>
              </View>
            ) : null
          }
        />
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
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, gap: 2 },
  archiveLabel: { fontSize: 9, fontWeight: 600, letterSpacing: 2.5 },
  channelName: { fontSize: 15, fontWeight: 600 },
  banner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  bannerText: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'monospace' },
  searchInput: {
    height: 38,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
  },
  groupHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  groupLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'monospace' },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 5,
  },
  rowTime: { fontSize: 10, fontFamily: 'monospace', flexShrink: 0 },
  rowNick: { fontSize: 12.5, fontWeight: 600, flexShrink: 0, maxWidth: '30%' },
  rowText: { flex: 1, fontSize: 14, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyCard: {
    margin: Spacing.lg,
    padding: Spacing.xxxl,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 9,
  },
  emptyTitle: { fontSize: 14.5, fontWeight: 600 },
  emptyHint: { fontSize: 12.5, lineHeight: 19, textAlign: 'center' },
  settingsButton: {
    marginTop: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});
