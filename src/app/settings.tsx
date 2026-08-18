import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { loggedIn, uid, logout } = useAuth();

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

        <View style={styles.placeholder}>
          <Text style={{ color: theme.mute }}>앱 설정 · 보관 정책 · Stage 4+</Text>
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
  body: { padding: Spacing.lg, gap: Spacing.xl },
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
  placeholder: { paddingHorizontal: Spacing.xs },
});
