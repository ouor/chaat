import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

export function ChannelAvatar({
  uri,
  name,
  size,
}: {
  uri?: string | null;
  name: string;
  size: number;
}) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (failed || !uri) {
    return (
      <View
        style={[
          styles.initial,
          { width: size, height: size, borderRadius: Radius.pill, backgroundColor: theme.canvasSoft2 },
        ]}>
        <Text style={[styles.text, { color: theme.body, fontSize: size * 0.42 }]}>
          {(name[0] ?? '?').toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: Radius.pill, backgroundColor: theme.canvasSoft }}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: 700,
  },
});
