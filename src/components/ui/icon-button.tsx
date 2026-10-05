import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, TOUCH, type ThemeColor } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** A 44dp round icon target with a pressed tint. `label` is read by screen readers. */
export function IconButton({
  name,
  label,
  onPress,
  color = 'ink',
  size = 22,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: ThemeColor;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: theme.canvasSoft2 }]}>
      <Icon name={name} color={theme[color]} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
