import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatPreview } from '@/components/chat/chat-preview';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Text } from '@/components/ui/text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented } from '@/components/ui/segmented';
import { Opacity, Radius, Spacing, TOUCH } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { updateSettings, useSettings, type ChatVariant, type FontScale, type RetentionDays, type ThemeMode } from '@/store/settings';
import { isChatKeeperAvailable } from '@/store/chat-keeper';
import { clearSavedChats, countLogs, pruneLogs } from '@/store/chat-logs';

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="heading" style={styles.sectionTitle}>{title}</Text>
      {description ? (
        <Text variant="labelRegular" tone="mute" style={styles.sectionDesc}>{description}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="labelStrong" tone="body">{label}</Text>
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
  const [logoutFailed, setLogoutFailed] = useState(false);

  const refreshCount = useCallback(() => {
    void countLogs().then(setLogCount);
  }, []);

  useFocusEffect(refreshCount);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <ScreenHeader title="설정" />

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.xxxl }]}>
        <View style={styles.accountBlock}>
        <View style={[styles.account, { backgroundColor: theme.surface }]}>
          <IconTile name={loggedIn ? 'check' : 'lock'} surface="surfaceRaised" tone="body" />
          <View style={styles.accountInfo}>
            <Text variant="bodyStrong">
              {loggedIn ? '네이버로 로그인했어요' : '로그인하지 않았어요'}
            </Text>
            <Text variant="caption" tone="mute">
              {loggedIn ? '로그인 정보는 이 폰의 보안 저장소에만 있어요' : '채팅 보기는 로그인 없이도 돼요'}
            </Text>
          </View>
          {loggedIn ? (
            <Button
              label="로그아웃"
              size="sm"
              variant="secondary"
              onPress={() => {
                setLogoutFailed(false);
                void logout().then((ok) => setLogoutFailed(!ok));
              }}
            />
          ) : (
            <Button label="로그인" size="sm" onPress={() => router.push('/login')} />
          )}
        </View>
        {logoutFailed ? (
          <Text variant="micro" tone="danger" style={styles.logoutError}>
            로그아웃하지 못했어요. 잠시 뒤 다시 눌러 주세요.
          </Text>
        ) : null}
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
                { label: '작게', value: 'sm' },
                { label: '보통', value: 'md' },
                { label: '크게', value: 'lg' },
                { label: '최대', value: 'xl' },
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
          <ChatPreview label="미리보기" />
        </Card>

        <Card
          title="채팅 기록"
          description="채팅방을 열어 둔 동안 올라온 채팅이 이 폰에 자동으로 저장돼요. 채팅방 오른쪽 위 '지난 채팅'을 누르면 다시 볼 수 있어요.">
          {isChatKeeperAvailable ? (
            <Field label="앱을 내려 둔 동안">
              <Segmented<'on' | 'off'>
                options={[
                  { label: '계속 받기', value: 'on' },
                  { label: '멈추기', value: 'off' },
                ]}
                value={settings.backgroundCollect ? 'on' : 'off'}
                onSelect={(v) => updateSettings({ backgroundCollect: v === 'on' })}
              />
              <Text variant="micro" tone="mute">
                {settings.backgroundCollect
                  ? '홈으로 나가거나 화면을 꺼도 채팅을 계속 받아 저장하고, 새 채팅을 알림으로 보여 줘요. 배터리를 조금 더 써요.'
                  : '앱을 내려 두면 채팅을 받지 않아요. 채팅방을 다시 열면 그때부터 저장돼요.'}
              </Text>
            </Field>
          ) : null}
          <Field label="보관 기간">
            <Segmented<RetentionDays>
              options={[
                { label: '7일', value: 7 },
                { label: '30일', value: 30 },
                { label: '90일', value: 90 },
                { label: '무제한', value: 0 },
              ]}
              value={settings.retentionDays}
              onSelect={(v) => {
                updateSettings({ retentionDays: v });
                void pruneLogs(v).then(refreshCount);
              }}
            />
          </Field>
          <View style={[styles.storage, { borderTopColor: theme.hairline }]}>
          <View style={styles.statRow}>
            <Text variant="label" tone="body">저장된 채팅</Text>
            <Text variant="labelStrong">
              {logCount === null ? '…' : `${logCount.toLocaleString()}개`}
            </Text>
          </View>
          <Pressable
            onPress={() => setConfirmClear(true)}
            disabled={!logCount}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkRow, { opacity: !logCount ? Opacity.disabled : pressed ? Opacity.pressed : 1 }]}>
            <Text variant="label" tone="danger">저장된 채팅 모두 지우기</Text>
            <Icon name="chevron" color={theme.mute} size="sm" />
          </Pressable>
          </View>
        </Card>

        <Text variant="caption" tone="mute" style={styles.footer}>
          chaat은 치지직 공식 앱이 아니에요.{'\n'}채팅 기록은 이 폰에만 저장되고 어디에도 보내지 않아요.
        </Text>
      </ScrollView>

      <BottomSheet
        visible={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="저장된 채팅을 모두 지울까요?"
        description={`${logCount ? `${logCount.toLocaleString()}개의 채팅이 지워져요. ` : ''}지운 채팅은 되돌릴 수 없어요.`}
        actions={
          <>
            <Button label="취소" variant="secondary" stretch onPress={() => setConfirmClear(false)} />
            <Button
              label="모두 지우기"
              variant="danger"
              stretch
              onPress={() => {
                setConfirmClear(false);
                void clearSavedChats().then(refreshCount);
              }}
            />
          </>
        }
      />
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
  accountBlock: { gap: Spacing.sm },
  accountInfo: { flex: 1, gap: Spacing.xxs },
  logoutError: { paddingHorizontal: Spacing.xs },
  section: { gap: Spacing.sm },
  sectionTitle: { paddingHorizontal: Spacing.xs },
  sectionDesc: { paddingHorizontal: Spacing.xs },
  card: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.xl },
  field: { gap: Spacing.sm },
  // Count + clear, set off from the fields above by a hairline instead of the card gap.
  storage: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH,
  },
  footer: { textAlign: 'center' },
});
