import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.canvasSoft, paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.sm },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.canvasSoft2 }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl + 8,
    borderTopRightRadius: Radius.xl + 8,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.lg,
  },
});
