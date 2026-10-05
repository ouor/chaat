import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { Spacing, Type } from '@/constants/tokens';
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
          <Text style={[Type.heading, { color: theme.ink }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[Type.micro, { color: theme.mute }]} numberOfLines={1}>
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
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  titleWrap: { flex: 1, minWidth: 0 },
});
