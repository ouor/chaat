import { StyleSheet, Text, View } from 'react-native';

import { Radius, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/**
 * App mark + wordmark. The mark is the launcher icon in miniature (assets/icon/icon.svg: a -12deg
 * green slash on a black tile); the Korean reading under the name answers "챗? 차앗?".
 */
export function Brand() {
  const theme = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="header" accessibilityLabel="챗, 치지직 채팅 보기">
      <View style={[styles.mark, { backgroundColor: theme.brandTile }]}>
        <View style={[styles.slash, { backgroundColor: theme.brandMark }]} />
      </View>
      <View>
        <Text style={[Type.heading, styles.word, { color: theme.ink }]}>chaat</Text>
        <Text style={[Type.micro, { color: theme.mute }]}>챗 · 치지직 채팅 보기</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: Radius.md + 2, alignItems: 'center', justifyContent: 'center' },
  // Same proportions as the icon: width 0.297 x height, leaning -12deg, slightly rounded.
  slash: { width: 6, height: 20, borderRadius: 1, transform: [{ skewX: '-12deg' }] },
  word: { lineHeight: 20, letterSpacing: -0.4 },
});
