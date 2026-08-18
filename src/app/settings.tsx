import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { updateSettings, useSettings, type FontScale, type RetentionDays, type ThemeMode } from '@/store/settings';
import { clearLogs, countLogs, pruneLogs } from '@/storage/log-repo';
import { useCallback, useState } from 'react';

function Segment<T extends string | number>({
  options,
  value,
  onSelect,
}: {
  options: { label: string; value: T }[];
  value: T;
  onSelect: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { borderColor: theme.hairline }]}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            style={[
              styles.segmentItem,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: theme.hairline },
              active && { backgroundColor: theme.primary },
            ]}>
            <Text style={[styles.segmentText, { color: active ? theme.onPrimary : theme.body }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.ink }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { loggedIn, uid, logout } = useAuth();
  const settings = useSettings();
  const [logCount, setLogCount] = useState<number | null>(null);

  const refreshCount = useCallback(() => {
    void countLogs().then(setLogCount);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Icon name="back" color={theme.body} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Settings</Text>
      </SafeAreaView>

      <View style={styles.body}>
        <View style={[styles.accountCard, { borderColor: theme.hairline }]}>
          <View style={[styles.avatar, { borderColor: theme.hairline, backgroundColor: theme.canvasSoft }]}>
            <Text style={[styles.avatarText, { color: theme.mute }]}>{loggedIn ? '·' : '?'}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={[styles.accountName, { color: theme.ink }]}>
              {loggedIn ? (uid ? `#${uid.slice(0, 8)}…` : 'Signed in') : 'Not signed in'}
            </Text>
            <Text style={[styles.accountSub, { color: theme.mute }]}>
              {loggedIn ? 'naver · session saved in keychain' : 'read-only mode'}
            </Text>
          </View>
          <Pressable
            onPress={() => (loggedIn ? logout() : router.push('/login'))}
            style={[
              styles.authButton,
              { borderColor: theme.hairline, backgroundColor: loggedIn ? 'transparent' : theme.primary },
            ]}>
            <Text style={{ color: loggedIn ? theme.body : theme.onPrimary, fontSize: 12.5, fontWeight: 600 }}>
              {loggedIn ? 'Sign out' : 'Sign in'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.mute }]}>APPEARANCE</Text>
          <Row label="Theme">
            <Segment<ThemeMode>
              options={[
                { label: 'Dark', value: 'dark' },
                { label: 'Light', value: 'light' },
              ]}
              value={settings.theme}
              onSelect={(v) => updateSettings({ theme: v })}
            />
          </Row>
          <Row label="Chat font size">
            <Segment<FontScale>
              options={['sm', 'md', 'lg', 'xl'].map((k) => ({ label: k.toUpperCase(), value: k as FontScale }))}
              value={settings.fontScale}
              onSelect={(v) => updateSettings({ fontScale: v })}
            />
          </Row>
          <Row label="Auto-scroll to newest">
            <Pressable onPress={() => updateSettings({ autoscroll: !settings.autoscroll })}>
              <View
                style={[
                  styles.switch,
                  { backgroundColor: settings.autoscroll ? theme.primary : theme.canvasSoft, borderColor: theme.hairline },
                ]}>
                <View
                  style={[
                    styles.switchKnob,
                    { backgroundColor: settings.autoscroll ? theme.onPrimary : theme.mute },
                    { alignSelf: settings.autoscroll ? 'flex-end' : 'flex-start' },
                  ]}
                />
              </View>
            </Pressable>
          </Row>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.mute }]}>CHAT LOGS</Text>
          <Row label="Keep for">
            <Segment<RetentionDays>
              options={[
                { label: '7d', value: 7 },
                { label: '30d', value: 30 },
                { label: '90d', value: 90 },
                { label: '∞', value: 0 },
              ]}
              value={settings.retentionDays}
              onSelect={(v) => {
                updateSettings({ retentionDays: v });
                void pruneLogs(v);
                refreshCount();
              }}
            />
          </Row>
          <Pressable
            onPress={() => {
              void clearLogs().then(refreshCount);
            }}
            style={[styles.linkRow, { borderTopColor: theme.hairline }]}>
            <Text style={{ color: theme.danger, fontSize: 14 }}>Delete all logs</Text>
            <Text style={{ color: theme.mute, fontSize: 12, fontFamily: 'monospace' }}>
              {logCount === null ? '' : `${logCount} rows`}
            </Text>
          </Pressable>
        </View>
      </View>
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
  title: { fontSize: 17, fontWeight: 600, letterSpacing: -0.3 },
  body: { padding: Spacing.lg, gap: Spacing.xxxl },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: 600 },
  accountInfo: { flex: 1, gap: 3 },
  accountName: { fontSize: 14.5, fontWeight: 600 },
  accountSub: { fontSize: 10.5, fontFamily: 'monospace' },
  authButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  section: { gap: Spacing.lg },
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: 2.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  rowLabel: { fontSize: 14 },
  segment: { flexDirection: 'row', borderRadius: Radius.sm, borderWidth: 1, overflow: 'hidden' },
  segmentItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace' },
  switch: {
    width: 44,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },
  switchKnob: { width: 20, height: 20, borderRadius: Radius.pill },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderTopWidth: 1,
  },
});
