export interface EmojiSegment {
  key: string;
  emojiId?: string;
  imageUrl?: string;
  text?: string;
}

const EMOJI_RE = /\{:([^{}:]+):\}/g;

export function splitEmoji(
  text: string,
  emojiMap: Record<string, string>,
  messageEmojis?: Record<string, string>,
): EmojiSegment[] {
  const out: EmojiSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  EMOJI_RE.lastIndex = 0;
  while ((m = EMOJI_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ key: `t${i++}`, text: text.slice(last, m.index) });
    const id = m[1];
    const url = messageEmojis?.[id] ?? emojiMap[id];
    if (url) {
      out.push({ key: `e${i++}`, emojiId: id, imageUrl: url });
    } else {
      out.push({ key: `t${i++}`, text: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ key: `t${i++}`, text: text.slice(last) });
  return out;
}

/** Text with emoji tokens dropped, for places that can't draw images (notifications). */
export function stripEmoji(text: string): { text: string; hadEmoji: boolean } {
  EMOJI_RE.lastIndex = 0;
  const hadEmoji = EMOJI_RE.test(text);
  EMOJI_RE.lastIndex = 0;
  return { text: text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim(), hadEmoji };
}
