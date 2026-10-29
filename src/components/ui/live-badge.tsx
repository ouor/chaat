import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

import { Radius, Size, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** Green LIVE pill. Only shown while a stream is live: an ended stream has no badge. */
export function LiveBadge() {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.primary }]}>
      <View style={[styles.dot, { backgroundColor: theme.onPrimary }]} />
      <Text variant="badgeCaps" tone="onPrimary">
        LIVE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.tight,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
  },
  dot: { width: Size.dot, height: Size.dot, borderRadius: Radius.pill },
});
