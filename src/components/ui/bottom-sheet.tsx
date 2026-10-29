import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/**
 * Modal sheet from the bottom. `title`/`description` form the standard heading, `children` the
 * body, and `actions` (Buttons with `stretch`) the button row at the end.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  actions,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Modal windows are edge-to-edge too (adjustResize is a no-op), so sheets with inputs
          (notice composer) must lift themselves above the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={[styles.overlay, { backgroundColor: theme.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.sm },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.surfaceRaised }]} />
          {title || description ? (
            <View style={styles.heading}>
              {title ? <Text variant="title">{title}</Text> : null}
              {description ? (
                <Text variant="labelRegular" tone="mute">
                  {description}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    ...Size.sheetHandle,
    borderRadius: Radius.pill,
  },
  heading: { gap: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
