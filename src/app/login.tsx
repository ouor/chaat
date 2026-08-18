import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth-context';
import { readNaverCookiesFromWebView } from '@/storage/cookie-reader';
import type { NaverCookies } from '@/storage/keychain';

const POLL_JS = `(function(){ window.ReactNativeWebView.postMessage(document.cookie); })(); true;`;

function parseCookies(cookie: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function cookiesFromDocumentCookie(cookie: string): NaverCookies | null {
  const parsed = parseCookies(cookie);
  if (parsed.NID_AUT && parsed.NID_SES) return { aut: parsed.NID_AUT, ses: parsed.NID_SES };
  return null;
}

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { login } = useAuth();

  const [phase, setPhase] = useState<'idle' | 'webview' | 'fail'>('idle');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (phase !== 'webview') return;
    const t = setInterval(() => {
      if (doneRef.current) return;
      webviewRef.current?.injectJavaScript(POLL_JS);
      void readNaverCookiesFromWebView().then((c) => {
        if (c && !doneRef.current) void tryLogin(c);
      });
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function tryLogin(cookies: NaverCookies): Promise<void> {
    if (busy || doneRef.current) return;
    setBusy(true);
    const ok = await login(cookies);
    if (ok) {
      doneRef.current = true;
      router.back();
    } else {
      setBusy(false);
      setPhase('fail');
    }
  }

  function handleMessage(e: { nativeEvent: { data: string } }) {
    const c = cookiesFromDocumentCookie(e.nativeEvent.data);
    if (c) void tryLogin(c);
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.root, { backgroundColor: theme.canvas, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: theme.mute }}>Naver sign-in is not supported on web.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Icon name="back" color={theme.body} />
        </Pressable>
        <View style={[styles.domainPill, { backgroundColor: theme.canvasSoft }]}>
          <Text style={[styles.domainText, { color: theme.mute }]}>nid.naver.com</Text>
        </View>
      </SafeAreaView>

      {phase === 'idle' ? (
        <View style={styles.center}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]} />
          <Text style={[styles.title, { color: theme.ink }]}>Sign in to chat</Text>
          <Text style={[styles.hint, { color: theme.mute }]}>
            Reading chat needs no account. Sending messages uses your Naver session.
          </Text>
          <Pressable
            onPress={() => {
              doneRef.current = false;
              setLoading(true);
              setPhase('webview');
            }}
            style={[styles.cta, { backgroundColor: theme.primary }]}>
            <Text style={[styles.ctaText, { color: theme.onPrimary }]}>Continue with Naver</Text>
          </Pressable>
        </View>
      ) : phase === 'fail' ? (
        <View style={styles.center}>
          <Text style={[styles.failLabel, { color: theme.danger }]}>SIGN-IN FAILED</Text>
          <Text style={[styles.title, { color: theme.ink }]}>Session wasn&apos;t returned</Text>
          <Text style={[styles.hint, { color: theme.mute }]}>
            The sign-in window closed before we got a token. You can keep reading chat while signed out.
          </Text>
          <View style={styles.failButtons}>
            <Pressable
              onPress={() => {
                doneRef.current = false;
                setLoading(true);
                setPhase('webview');
              }}
              style={[styles.cta, { backgroundColor: theme.primary }]}>
              <Text style={[styles.ctaText, { color: theme.onPrimary }]}>Try again</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={[styles.outlineButton, { borderColor: theme.hairline }]}>
              <Text style={{ color: theme.ink, fontSize: 13, fontWeight: 600 }}>Read-only</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.webviewWrap}>
          <WebView
            ref={webviewRef}
            source={{ uri: 'https://nid.naver.com/nidlogin.login' }}
            onNavigationStateChange={(nav) => {
              if (nav.url.includes('naver.com') && !doneRef.current) webviewRef.current?.injectJavaScript(POLL_JS);
            }}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
            style={styles.webview}
          />
          {loading || busy ? (
            <View style={[styles.overlay, { backgroundColor: theme.canvas }]}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.overlayText, { color: theme.body }]}>
                {busy ? 'Signing in…' : 'Opening Naver sign-in…'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  domainPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  domainText: { fontSize: 11, fontFamily: 'monospace' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing.xxxl },
  logo: { width: 11, height: 20, borderRadius: 1, transform: [{ skewX: '-12deg' }] },
  title: { fontSize: 18, fontWeight: 600, letterSpacing: -0.3 },
  hint: { fontSize: 12.5, lineHeight: 20, textAlign: 'center' },
  cta: {
    marginTop: 8,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: 600 },
  failLabel: { fontSize: 10, letterSpacing: 1.6, fontFamily: 'monospace' },
  failButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  outlineButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderRadius: Radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
  },
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
  overlayText: { fontSize: 13.5 },
});
