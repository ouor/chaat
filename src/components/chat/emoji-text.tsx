import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { splitEmoji } from '@/client/chzzk/emoji';

export function EmojiText({
  text,
  emojiMap,
  messageEmojis,
  fontSize,
  color,
  opacity = 1,
}: {
  text: string;
  emojiMap: Record<string, string>;
  messageEmojis?: Record<string, string>;
  fontSize: number;
  color: string;
  opacity?: number;
}) {
  const segments = useMemo(() => splitEmoji(text, emojiMap, messageEmojis), [text, emojiMap, messageEmojis]);

  return (
    <View style={[styles.row, { opacity }]}>
      {segments.map((s) =>
        s.emojiId ? (
          <Image key={s.key} source={{ uri: s.imageUrl }} style={[styles.emoji, { width: fontSize + 2, height: fontSize + 2 }]} contentFit="contain" />
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
  // Every emoji gets the same square box, slightly above cap height, so mixed packs line up.
  emoji: { marginHorizontal: 1 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
