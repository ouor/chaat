import { Colors } from '@/constants/tokens';
import { useSettings } from '@/store/settings';

export function useTheme() {
  const { theme } = useSettings();
  return Colors[theme];
}
