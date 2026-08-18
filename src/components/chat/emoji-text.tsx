import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { splitEmoji } from '@/client/chzzk/emoji';

export function EmojiText({
  text,
  emojiMap,
  fontSize,
  color,
  opacity = 1,
}: {
  text: string;
  emojiMap: Record<string, string>;
  fontSize: number;
  color: string;
  opacity?: number;
}) {
  const segments = useMemo(() => splitEmoji(text, emojiMap), [text, emojiMap]);

  return (
    <View style={[styles.row, { opacity }]}>
      {segments.map((s) =>
        s.emojiId ? (
          <Image key={s.key} source={{ uri: s.imageUrl }} style={{ width: fontSize + 4, height: fontSize + 4 }} contentFit="contain" />
        ) : (
          <Text key={s.key} style={{ color, fontSize, lineHeight: fontSize + 6 }}>
            {s.text}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
