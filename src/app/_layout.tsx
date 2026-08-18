import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/store/auth-context';
import { getSettings } from '@/store/settings';
import { pruneLogs } from '@/storage/log-repo';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const { retentionDays } = getSettings();
    void pruneLogs(retentionDays);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
