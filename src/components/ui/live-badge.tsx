import { StyleSheet, Text, View } from 'react-native';

import { Radius, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** Green LIVE pill. Only shown while a stream is live: an ended stream has no badge. */
export function LiveBadge() {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.primary }]}>
      <View style={[styles.dot, { backgroundColor: theme.onPrimary }]} />
      <Text style={[Type.badge, styles.live, { color: theme.onPrimary }]}>LIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  dot: { width: 5, height: 5, borderRadius: Radius.pill },
  live: { letterSpacing: 0.5 },
});
