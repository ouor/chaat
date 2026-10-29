import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/**
 * Centered placeholder for a screen or list with nothing to show: optional icon, a title, a hint
 * and an action (`children`). `loading` shows a spinner with `title` as its caption instead.
 */
export function EmptyState({
  icon,
  title,
  hint,
  loading = false,
  children,
  style,
  onLayout,
}: {
  icon?: IconName;
  title?: string;
  hint?: string;
  loading?: boolean;
  children?: React.ReactNode;
  // As a list's ListEmptyComponent, the list injects these (an inverted list's flip-back
  // transform and its layout probe); dropping them renders the state upside down.
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  if (loading) {
    return (
      <View style={[styles.wrap, style]} onLayout={onLayout}>
        <ActivityIndicator color={theme.mute} />
        {title ? (
          <Text variant="label" tone="mute">
            {title}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {icon ? (
        <View style={styles.icon}>
          <IconTile name={icon} size="xl" tone="mute" />
        </View>
      ) : null}
      {title ? <Text variant="bodyStrong">{title}</Text> : null}
      {hint ? (
        <Text variant="labelRegular" tone="mute" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxxxl,
    paddingVertical: Spacing.xxxxxl,
  },
  icon: { marginBottom: Spacing.xs },
  hint: { textAlign: 'center', marginBottom: Spacing.sm },
});
