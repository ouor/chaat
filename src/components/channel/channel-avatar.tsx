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
          { width: size, height: size, borderRadius: Radius.pill, backgroundColor: theme.canvasSoft, borderColor: theme.hairline },
        ]}>
        <Text style={[styles.text, { color: theme.mute, fontSize: size * 0.4, fontWeight: '600' }]}>
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
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  text: {
    fontFamily: 'monospace',
  },
});
