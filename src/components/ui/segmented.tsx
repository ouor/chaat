import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

import { Radius, Spacing, TOUCH } from '@/constants/tokens';
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
  options: { label: string; value: T }[];
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
            style={[styles.item, active && { backgroundColor: theme.surfaceRaised }]}>
            <Text variant={active ? 'labelStrong' : 'label'} tone={active ? 'ink' : 'mute'}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TRACK_PAD = 3;

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.lg, padding: TRACK_PAD, gap: TRACK_PAD },
  item: {
    flex: 1,
    minHeight: TOUCH - 2 * TRACK_PAD,
    // Concentric with the track's corner.
    borderRadius: Radius.lg - TRACK_PAD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
});
