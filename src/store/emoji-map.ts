import { useEffect, useState } from 'react';

import { getEmojiPacks } from '@/client/chzzk/rest';

/** Channel emoji id -> image URL (CHZZK base packs plus the channel's own), empty until loaded. */
export function useEmojiMap(channelId: string, cookie?: string): Record<string, string> {
  const [emojiMap, setEmojiMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    getEmojiPacks(channelId, cookie)
      .then((emojis) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const e of emojis) map[e.emojiId] = e.imageUrl;
        setEmojiMap(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [channelId, cookie]);

  return emojiMap;
}
