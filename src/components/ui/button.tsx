import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Opacity, Radius, Size, Spacing, TOUCH, type ThemeColor } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

const VARIANT = {
  /** The only green surface besides LIVE and donations. */
  primary: { bg: 'primary', fg: 'onPrimary' },
  secondary: { bg: 'surfaceRaised', fg: 'ink' },
  danger: { bg: 'surfaceRaised', fg: 'danger' },
  /** Quiet button on the canvas (header chips, "더 보기"). */
  tonal: { bg: 'surface', fg: 'ink' },
  /** Floating on content ("새 메시지"). */
  inverse: { bg: 'ink', fg: 'canvas' },
} as const satisfies Record<string, { bg: ThemeColor; fg: ThemeColor }>;

const DISABLED = { bg: 'surfaceRaised', fg: 'mute' } as const;

/** Filled button. `chip` is the compact pill for screen headers. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  busy = false,
  disabled = false,
  pill = false,
  stretch = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: keyof typeof VARIANT;
  size?: 'chip' | 'sm' | 'md' | 'lg';
  icon?: IconName;
  /** Shows a spinner in place of the icon; the button is disabled meanwhile. */
  busy?: boolean;
  disabled?: boolean;
  pill?: boolean;
  stretch?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const off = disabled || busy;
  const c = off ? DISABLED : VARIANT[variant];
  const fg = theme[c.fg];
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: off, busy }}
      // A chip is drawn smaller than a touch target; its hit area is not.
      hitSlop={size === 'chip' ? (TOUCH - Size.chip) / 2 : undefined}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        (pill || size === 'chip') && styles.pill,
        stretch && styles.stretch,
        { backgroundColor: theme[c.bg], opacity: pressed ? Opacity.pressed : 1 },
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Icon name={icon} color={fg} size="sm" />
      ) : null}
      <Text variant={size === 'lg' ? 'bodyStrong' : size === 'chip' ? 'microStrong' : 'labelStrong'} tone={c.fg}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  chip: { height: Size.chip, paddingHorizontal: Spacing.md },
  sm: { minHeight: Size.buttonSm, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  md: { minHeight: TOUCH, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg },
  lg: { minHeight: Size.buttonLg, paddingHorizontal: Spacing.xl, borderRadius: Radius.xl },
  pill: { borderRadius: Radius.pill },
  stretch: { alignSelf: 'stretch', flexGrow: 1, flexBasis: 0 },
});
