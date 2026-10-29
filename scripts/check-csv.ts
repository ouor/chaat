import { ANONYMOUS_DONOR } from '../src/constants/chat-text';
import { csvCell, csvHeader, csvLine } from '../src/lib/chat-csv';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`chat-csv self-check failed: ${msg}`);
}

assert(csvCell('안녕') === '안녕', 'plain cell');
assert(csvCell('a,b') === '"a,b"', 'comma quoted');
assert(csvCell('say "hi"') === '"say ""hi"""', 'quote doubled');
assert(csvCell('줄1\n줄2') === '"줄1\n줄2"', 'newline quoted');
assert(csvCell('=HYPERLINK("x")') === `"'=HYPERLINK(""x"")"`, 'formula neutralized');
assert(csvCell('-ㅋㅋ') === "'-ㅋㅋ", 'leading minus neutralized');
assert(csvHeader() === '날짜,시간,닉네임,종류,메시지,후원 금액\r\n', 'header');

const t = new Date(2026, 9, 8, 9, 5, 7).getTime();
const line = csvLine({ nickname: '', message: '응원해요', type: 'donation', msg_time: t, extras_json: '{"payAmount":"1,000"}' });
assert(line === `2026-10-08,09:05:07,${ANONYMOUS_DONOR},후원,응원해요,1000\r\n`, `donation line: ${line}`);
const blinded = csvLine({ nickname: '민재', message: '', type: 'blinded', msg_time: t, extras_json: null });
const sys = csvLine({ nickname: '', message: '관리자 전용 채팅', type: 'system', msg_time: t, extras_json: null });
assert(sys === '2026-10-08,09:05:07,,알림,관리자 전용 채팅,\r\n', `system line: ${sys}`);
assert(blinded === '2026-10-08,09:05:07,민재,가려짐,,\r\n', `blinded line: ${blinded}`);

console.log('csv self-check: ok');
