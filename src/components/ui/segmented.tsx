import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/**
 * Full-width segmented control: a gray track with a raised selected tab. Neutral on purpose:
 * a selected setting is not a call to action, so it doesn't use the green accent.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onSelect,
}: {
  options: { label: string; value: T; fontSize?: number }[];
  value: T;
  onSelect: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.canvas }]} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.item, active && { backgroundColor: theme.canvasSoft2 }]}>
            <Text
              style={[
                Type.label,
                { color: active ? theme.ink : theme.mute, fontWeight: active ? 700 : 500 },
                opt.fontSize ? { fontSize: opt.fontSize, lineHeight: opt.fontSize + 6 } : null,
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.lg, padding: 3, gap: 3 },
  item: {
    flex: 1,
    minHeight: TOUCH - 4,
    borderRadius: Radius.md + 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
});
