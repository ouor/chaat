import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';

import { Colors } from '@/constants/tokens';
import { AuthProvider } from '@/store/auth-context';
import { getSettings, useSettings } from '@/store/settings';
import { pruneLogs } from '@/store/chat-logs';

export default function RootLayout() {
  const { theme } = useSettings();

  useEffect(() => {
    const { retentionDays } = getSettings();
    void pruneLogs(retentionDays);
  }, []);

  // Navigator-drawn areas (screen background during transitions) use the app's own colors.
  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[theme];
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.canvas, card: c.canvas, text: c.ink, border: c.hairline, primary: c.primary },
  };

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
