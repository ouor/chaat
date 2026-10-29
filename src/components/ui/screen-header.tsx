import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** Back button + title row shared by every pushed screen. `children` replaces the title. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.canvas }]}>
      <IconButton name="back" label="뒤로" onPress={() => router.back()} />
      {children ?? (
        <View style={styles.titleWrap}>
          <Text variant="heading" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="micro" tone="mute" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
      {right}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingLeft: Spacing.xs,
    // Icon buttons carry their own 44dp box; a chip at the end needs the extra edge room.
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  titleWrap: { flex: 1, minWidth: 0 },
});
