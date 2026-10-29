import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

const TONE = {
  neutral: { bg: 'surfaceRaised', fg: 'body' },
  inverse: { bg: 'ink', fg: 'canvas' },
  accent: { bg: 'primaryTint', fg: 'accentText' },
} as const;

/** Small label next to a name (스트리머, 매니저, 구독, 인증, 후원). */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: keyof typeof TONE }) {
  const theme = useTheme();
  const t = TONE[tone];
  return (
    <View style={[styles.tag, { backgroundColor: theme[t.bg] }]}>
      <Text variant="badge" tone={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderRadius: Radius.xs, paddingHorizontal: Spacing.tight, paddingVertical: Spacing.xxs },
});
