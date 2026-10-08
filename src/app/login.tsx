import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import type { NaverCookies } from '@/store/auth-context';
import { isNaverUrl, urlHost } from '@/store/naver-url';

// Reassurance for people wary of signing in through an app they don't know yet.
const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'lock', title: '네이버 공식 페이지에서 로그인해요', body: '다음 화면에서 네이버 로그인 페이지(nid.naver.com)가 열려요.' },
  { icon: 'phone', title: '비밀번호는 앱에 저장되지 않아요', body: '로그인 후 받은 정보만 이 폰의 보안 저장소에 보관해요.' },
  { icon: 'gear', title: '언제든 로그아웃할 수 있어요', body: '설정에서 로그아웃하면 이 폰에서 바로 지워져요.' },
];

// The login WebView is a trust boundary: session cookies are read only from the native cookie
// store (NID_AUT is HttpOnly, so page JS never sees it and nothing a page posts is trusted), and
// top-level navigation is kept on https *.naver.com so no other page can sit inside the login screen.
// Subframes (captcha etc.) may load web content, but never hand off to other apps (intent:, ...).
const SUBFRAME_URL = /^(https:|about:|data:|blob:)/i;

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { login, readWebViewSession } = useAuth();

  const [phase, setPhase] = useState<'idle' | 'webview' | 'fail'>('idle');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState('nid.naver.com');
  const doneRef = useRef(false);
  const webRef = useRef<WebView>(null);
  // A ref, not the `busy` state: the 2s poll closure is created once and would only ever see busy=false.
  const busyRef = useRef(false);
  // If the user backs out while login() is in flight, finishing must not pop another screen.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function tryLogin(cookies: NaverCookies): Promise<void> {
    if (busyRef.current || doneRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ok = await login(cookies);
    busyRef.current = false;
    if (!mountedRef.current) {
      doneRef.current = ok;
      return;
    }
    if (ok) {
      doneRef.current = true;
      router.back();
    } else {
      setBusy(false);
      setPhase('fail');
    }
  }

  useEffect(() => {
    if (phase !== 'webview') return;
    const t = setInterval(() => {
      if (doneRef.current) return;
      void readWebViewSession().then((c) => {
        if (c && !doneRef.current) void tryLogin(c);
      });
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function startWebview() {
    doneRef.current = false;
    setLoading(true);
    setPhase('webview');
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <ScreenHeader title="로그인" />
        <View style={styles.center}>
          <Text style={[Type.label, { color: theme.mute }]}>웹에서는 네이버 로그인을 지원하지 않아요.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      {phase === 'webview' ? (
        // The domain is shown only while Naver's page is actually on screen; before that it read
        // like an address bar and made the intro look like a (fake) Naver page.
        <ScreenHeader>
          <View style={styles.headerMain}>
            <Text style={[Type.heading, { color: theme.ink }]}>네이버 로그인</Text>
            <View style={[styles.domainPill, { backgroundColor: theme.canvasSoft }]}>
              <Icon name="lock" color={theme.mute} size={13} />
              <Text style={[Type.micro, { color: theme.body }]}>{host}</Text>
            </View>
          </View>
        </ScreenHeader>
      ) : (
        <ScreenHeader title="로그인" />
      )}

      {phase === 'idle' ? (
        <>
          <ScrollView contentContainerStyle={styles.intro}>
            <Text style={[Type.hero, { color: theme.ink }]}>채팅을 보내려면{'\n'}네이버 로그인이 필요해요</Text>
            <Text style={[Type.body, { color: theme.body }]}>채팅 보기는 로그인 없이도 할 수 있어요.</Text>
            <View style={styles.points}>
              {POINTS.map((p) => (
                <View key={p.title} style={styles.point}>
                  <View style={[styles.pointIcon, { backgroundColor: theme.canvasSoft }]}>
                    <Icon name={p.icon} color={theme.ink} size={20} />
                  </View>
                  <View style={styles.pointText}>
                    <Text style={[Type.bodyStrong, { color: theme.ink }]}>{p.title}</Text>
                    <Text style={[Type.label, { color: theme.mute, fontWeight: 400 }]}>{p.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <Button label="네이버로 로그인" size="lg" onPress={startWebview} />
            <Button label="나중에 할게요" variant="secondary" size="lg" onPress={() => router.back()} />
          </View>
        </>
      ) : phase === 'fail' ? (
        <>
          <View style={styles.center}>
            <Text style={[Type.title, { color: theme.ink }]}>로그인을 마치지 못했어요</Text>
            <Text style={[Type.label, styles.centerText, { color: theme.mute }]}>
              로그인 창이 닫혔거나 로그인 정보를 받지 못했어요.{'\n'}로그인하지 않아도 채팅은 계속 볼 수 있어요.
            </Text>
          </View>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <Button label="다시 시도" size="lg" onPress={startWebview} />
            <Button label="로그인 없이 보기" variant="secondary" size="lg" onPress={() => router.back()} />
          </View>
        </>
      ) : (
        <View style={styles.webviewWrap}>
          <WebView
            ref={webRef}
            source={{ uri: 'https://nid.naver.com/nidlogin.login' }}
            // '*' so every URL reaches the check below; a narrower list makes the WebView hand
            // non-matching URLs (intent:, other apps' schemes) straight to Linking.openURL.
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(req) => (req.isTopFrame ? isNaverUrl(req.url) : SUBFRAME_URL.test(req.url))}
            // The check above is skipped for POST navigations and fails open when JS is slow, so
            // also stop any top-level page that isn't Naver once it starts loading.
            onLoadStart={({ nativeEvent }) => {
              if (isNaverUrl(nativeEvent.url)) return;
              webRef.current?.stopLoading();
              setPhase('fail');
            }}
            onNavigationStateChange={(nav) => setHost(urlHost(nav.url))}
            onLoadEnd={() => setLoading(false)}
            style={styles.webview}
          />
          {loading || busy ? (
            <View style={[styles.overlay, { backgroundColor: theme.canvas }]}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[Type.label, { color: theme.body }]}>
                {busy ? '로그인하는 중…' : '네이버 로그인 화면을 여는 중…'}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  domainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  intro: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.md },
  points: { marginTop: Spacing.xxl, gap: Spacing.xl },
  point: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start' },
  pointIcon: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, gap: 2 },
  footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xxl },
  centerText: { textAlign: 'center', fontWeight: 400 },
  webviewWrap: { flex: 1 },
  webview: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
