import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/**
 * App mark + wordmark. The mark is neutral (ink tile, chat glyph) because green is reserved for
 * CTA / LIVE / donation; the Korean reading under the name answers "챗? 차앗?".
 */
export function Brand() {
  const theme = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="header" accessibilityLabel="챗, 치지직 채팅 보기">
      <View style={[styles.mark, { backgroundColor: theme.ink }]}>
        <Icon name="chat" color={theme.canvas} size={18} />
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
  word: { lineHeight: 20, letterSpacing: -0.4 },
});
