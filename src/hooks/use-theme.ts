import { Colors, type Theme } from '@/constants/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const theme: Theme = scheme === 'dark' ? 'dark' : 'light';
  return Colors[theme];
}
