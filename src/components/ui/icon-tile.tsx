import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, TileSize } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** An icon on a tinted tile: rounded square in feature lists, circle for status/empty states. */
export function IconTile({
  name,
  size = 'md',
  shape = 'circle',
  surface = 'surface',
  tone = 'ink',
}: {
  name: IconName;
  /** Tile size; the icon takes the IconSize step of the same name. */
  size?: keyof typeof TileSize;
  shape?: 'circle' | 'rounded';
  surface?: 'surface' | 'surfaceRaised';
  tone?: 'ink' | 'body' | 'mute';
}) {
  const theme = useTheme();
  const px = TileSize[size];
  return (
    <View
      style={[
        styles.tile,
        { width: px, height: px, backgroundColor: theme[surface] },
        { borderRadius: shape === 'circle' ? Radius.pill : Radius.lg },
      ]}>
      <Icon name={name} color={theme[tone]} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
