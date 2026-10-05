import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '@/client/chzzk/types';
import { ChatRow } from '@/components/chat/chat-row';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { updateSettings, useSettings, type ChatVariant, type FontScale, type RetentionDays, type ThemeMode } from '@/store/settings';
import { clearLogs, countLogs, pruneLogs } from '@/storage/log-repo';

const sample = (p: Partial<ChatMessage> & Pick<ChatMessage, 'nickname' | 'message'>): ChatMessage => ({
  chatChannelId: 'preview',
  userIdHash: p.nickname,
  msgType: 'text',
  role: 'member',
  msgTime: 0,
  extras: {},
  ...p,
});

const PREVIEW: ChatMessage[] = [
  sample({ nickname: '하늘', message: '오늘 방송도 재밌었어요!' }),
  sample({ nickname: '보라', message: '다음 방송은 언제 하나요?', role: 'manager' }),
  sample({ nickname: '민재', message: '수고하셨습니다', msgType: 'donation', donationAmount: 1000 }),
];

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[Type.heading, styles.sectionTitle, { color: theme.ink }]}>{title}</Text>
      {description ? (
        <Text style={[Type.label, styles.sectionDesc, { color: theme.mute }]}>{description}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.canvasSoft }]}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[Type.label, { color: theme.body, fontWeight: 600 }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { loggedIn, logout } = useAuth();
  const settings = useSettings();
  const [logCount, setLogCount] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const refreshCount = useCallback(() => {
    void countLogs().then(setLogCount);
  }, []);

  useFocusEffect(refreshCount);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <ScreenHeader title="설정" />

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.xxxl }]}>
        <View style={[styles.account, { backgroundColor: theme.canvasSoft }]}>
          <View style={[styles.accountIcon, { backgroundColor: theme.canvasSoft2 }]}>
            <Icon name="lock" color={theme.body} size={20} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={[Type.bodyStrong, { color: theme.ink }]}>
              {loggedIn ? '네이버로 로그인했어요' : '로그인하지 않았어요'}
            </Text>
            <Text style={[Type.caption, { color: theme.mute }]}>
              {loggedIn ? '로그인 정보는 이 폰의 보안 저장소에만 있어요' : '채팅 보기는 로그인 없이도 돼요'}
            </Text>
          </View>
          {loggedIn ? (
            <Button label="로그아웃" size="sm" variant="secondary" onPress={logout} />
          ) : (
            <Button label="로그인" size="sm" onPress={() => router.push('/login')} />
          )}
        </View>

        <Card title="화면">
          <Field label="테마">
            <Segmented<ThemeMode>
              options={[
                { label: '어둡게', value: 'dark' },
                { label: '밝게', value: 'light' },
              ]}
              value={settings.theme}
              onSelect={(v) => updateSettings({ theme: v })}
            />
          </Field>
          <Field label="채팅 글자 크기">
            <Segmented<FontScale>
              options={[
                { label: '작게', value: 'sm', fontSize: 13 },
                { label: '보통', value: 'md', fontSize: 15 },
                { label: '크게', value: 'lg', fontSize: 17 },
                { label: '최대', value: 'xl', fontSize: 19 },
              ]}
              value={settings.fontScale}
              onSelect={(v) => updateSettings({ fontScale: v })}
            />
          </Field>
          <Field label="채팅 모양">
            <Segmented<ChatVariant>
              options={[
                { label: '두 줄로 넉넉하게', value: 'card' },
                { label: '한 줄로 촘촘하게', value: 'compact' },
              ]}
              value={settings.chatVariant}
              onSelect={(v) => updateSettings({ chatVariant: v })}
            />
          </Field>
          <View style={[styles.preview, { backgroundColor: theme.canvas }]}>
            <Text style={[Type.micro, styles.previewLabel, { color: theme.mute }]}>미리보기</Text>
            {PREVIEW.map((m) => (
              <ChatRow key={m.nickname} m={m} showTime={false} />
            ))}
          </View>
        </Card>

        <Card
          title="채팅 기록"
          description="본 채팅은 이 폰에 자동으로 저장돼요. 채팅방 오른쪽 위 시계 버튼을 누르면 다시 볼 수 있어요.">
          <Field label="보관 기간">
            <Segmented<RetentionDays>
              options={[
                { label: '7일', value: 7 },
                { label: '30일', value: 30 },
                { label: '90일', value: 90 },
                { label: '계속', value: 0 },
              ]}
              value={settings.retentionDays}
              onSelect={(v) => {
                updateSettings({ retentionDays: v });
                void pruneLogs(v).then(refreshCount);
              }}
            />
          </Field>
          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
          <View style={styles.statRow}>
            <Text style={[Type.label, { color: theme.body }]}>저장된 채팅</Text>
            <Text style={[Type.label, { color: theme.ink, fontWeight: 700 }]}>
              {logCount === null ? '…' : `${logCount.toLocaleString()}개`}
            </Text>
          </View>
          <Pressable
            onPress={() => setConfirmClear(true)}
            disabled={!logCount}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkRow, { opacity: !logCount ? 0.4 : pressed ? 0.6 : 1 }]}>
            <Text style={[Type.label, { color: theme.danger }]}>저장된 채팅 모두 지우기</Text>
            <Icon name="chevron" color={theme.mute} size={16} />
          </Pressable>
        </Card>

        <Text style={[Type.micro, styles.footer, { color: theme.mute }]}>
          chaat은 치지직 공식 앱이 아니에요.{'\n'}채팅 기록은 이 폰에만 저장되고 어디에도 보내지 않아요.
        </Text>
      </ScrollView>

      <BottomSheet visible={confirmClear} onClose={() => setConfirmClear(false)}>
        <View style={styles.sheet}>
          <Text style={[Type.title, { color: theme.ink }]}>저장된 채팅을 모두 지울까요?</Text>
          <Text style={[Type.body, { color: theme.mute }]}>
            {logCount ? `${logCount.toLocaleString()}개의 채팅이 지워져요. ` : ''}지운 채팅은 되돌릴 수 없어요.
          </Text>
          <View style={styles.sheetActions}>
            <Button label="취소" variant="secondary" stretch onPress={() => setConfirmClear(false)} />
            <Button
              label="모두 지우기"
              variant="danger"
              stretch
              onPress={() => {
                setConfirmClear(false);
                void clearLogs().then(refreshCount);
              }}
            />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.xxxl },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: { flex: 1, gap: 2 },
  section: { gap: Spacing.sm },
  sectionTitle: { paddingHorizontal: Spacing.xs },
  sectionDesc: { paddingHorizontal: Spacing.xs, fontWeight: 400 },
  card: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.xl },
  field: { gap: Spacing.sm },
  preview: { borderRadius: Radius.lg, paddingVertical: Spacing.sm },
  previewLabel: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: -Spacing.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH,
    marginVertical: -Spacing.md,
  },
  footer: { textAlign: 'center', lineHeight: 18 },
  sheet: { gap: Spacing.md },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
