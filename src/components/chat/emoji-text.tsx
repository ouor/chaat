import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { splitEmoji } from '@/client/chzzk/emoji';
import { chatType } from '@/constants/tokens';

export function EmojiText({
  text,
  emojiMap,
  messageEmojis,
  fontSize,
  color,
}: {
  text: string;
  emojiMap: Record<string, string>;
  messageEmojis?: Record<string, string>;
  /** Chat body size; the line height and emoji box follow from it (chatType). */
  fontSize: number;
  color: string;
}) {
  const segments = useMemo(() => splitEmoji(text, emojiMap, messageEmojis), [text, emojiMap, messageEmojis]);
  const t = chatType(fontSize);

  return (
    <View style={styles.row}>
      {segments.map((s) =>
        s.emojiId ? (
          <Image key={s.key} source={{ uri: s.imageUrl }} style={[styles.emoji, { width: t.emoji, height: t.emoji }]} contentFit="contain" cachePolicy="memory-disk" />
        ) : (
          <Text key={s.key} style={[t.body, { color }]}>
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
