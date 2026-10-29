import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AvatarSize, Radius, type AvatarSizeName } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** Round profile/channel image; falls back to the name's first letter when missing or broken. */
export function Avatar({ uri, name, size }: { uri?: string | null; name: string; size: AvatarSizeName }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const px = AvatarSize[size];
  const box = { width: px, height: px, borderRadius: Radius.pill };

  if (failed || !uri) {
    return (
      <View style={[styles.initial, box, { backgroundColor: theme.surfaceRaised }]}>
        <Text style={[styles.letter, { color: theme.body, fontSize: Math.round(px * 0.42) }]}>
          {(name[0] ?? '?').toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[box, { backgroundColor: theme.surface }]}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // Scales with the avatar, not the type scale: it is part of the picture, not text to read.
  letter: { fontWeight: 700 },
});
