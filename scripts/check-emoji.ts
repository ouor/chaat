import { splitEmoji } from '../src/client/chzzk/emoji';

const assert = (cond: boolean, label: string) => {
  if (!cond) throw new Error(`emoji self-check failed: ${label}`);
};

const seg = splitEmoji('hi {:d_1:} bye {:unknown:}', { d_1: 'https://x/1.png' });
assert(seg.length === 4, 'emoji split count');
assert(seg[1].emojiId === 'd_1' && seg[1].imageUrl === 'https://x/1.png', 'emoji image lookup');
assert(seg[3].text === '{:unknown:}', 'unknown emoji kept as text');
const own = splitEmoji('{:sub_1:}', {}, { sub_1: 'https://x/s.png' });
assert(own[0].imageUrl === 'https://x/s.png', 'message emoji lookup');

console.log('emoji self-check: ok');
