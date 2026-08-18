import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider } from '@/store/auth-context';
import { getSettings, useSettings } from '@/store/settings';
import { pruneLogs } from '@/storage/log-repo';

export default function RootLayout() {
  const { theme } = useSettings();

  useEffect(() => {
    const { retentionDays } = getSettings();
    void pruneLogs(retentionDays);
  }, []);

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
