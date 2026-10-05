import { Pressable, StyleSheet, Text } from 'react-native';

import { Radius, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'danger';

/** Filled button. `primary` is the only green surface besides LIVE and donations. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  stretch = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  stretch?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.primary : theme.canvasSoft2;
  const fg = variant === 'primary' ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        stretch && styles.stretch,
        { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Text style={[size === 'lg' ? Type.bodyStrong : Type.label, styles.text, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  lg: { minHeight: 54, paddingHorizontal: Spacing.xl, borderRadius: Radius.xl },
  stretch: { alignSelf: 'stretch', flexGrow: 1, flexBasis: 0 },
  text: { fontWeight: 700 },
});
