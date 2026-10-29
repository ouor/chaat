import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing, TOUCH, Type } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** Search box with a leading magnifier and a clear (x) button while it has text. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onSubmitEditing,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  /** Placement only (flex, margins). */
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface }, style]}>
      <Icon name="search" color={theme.mute} size="md" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.mute}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        style={[Type.body, styles.input, { color: theme.ink }]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={12} accessibilityLabel="검색어 지우기">
          <View style={[styles.clear, { backgroundColor: theme.surfaceRaised }]}>
            <Icon name="close" color={theme.body} size="xs" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: TOUCH,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  input: { flex: 1, height: TOUCH, paddingVertical: 0 },
  clear: { width: Size.clear, height: Size.clear, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
