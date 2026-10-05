import { StyleSheet, Text, View } from 'react-native';

import { Radius, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** Green LIVE pill, or a neutral "방송 종료" pill when `ended`. */
export function LiveBadge({ ended = false }: { ended?: boolean }) {
  const theme = useTheme();
  if (ended) {
    return (
      <View style={[styles.pill, { backgroundColor: theme.canvasSoft2 }]}>
        <Text style={[Type.badge, { color: theme.body }]}>방송 종료</Text>
      </View>
    );
  }
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
