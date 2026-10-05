import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Radius, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/**
 * App mark + wordmark. The mark is the launcher icon in miniature (assets/icon/icon.svg: a -12deg
 * green slash on a black tile); the Korean reading under the name answers "챗? 차앗?".
 */
const MARK = 34;
// icon.svg's rect (178 x 600, centered) after skewX(-12), as a plain polygon. Drawn with SVG
// because a skew transform on a native View is not applied on Android (it rendered as "|").
const SLASH = 'M486.8 212H664.8L537.2 812H359.2Z';

export function Brand() {
  const theme = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="header" accessibilityLabel="챗, 치지직 채팅 보기">
      <View style={[styles.mark, { backgroundColor: theme.brandTile }]}>
        <Svg width={MARK} height={MARK} viewBox="0 0 1024 1024">
          <Path d={SLASH} fill={theme.brandMark} />
        </Svg>
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
  mark: { width: MARK, height: MARK, borderRadius: Radius.md + 2, alignItems: 'center', justifyContent: 'center' },
  word: { lineHeight: 20, letterSpacing: -0.4 },
});
