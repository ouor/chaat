// Archive rows -> CSV text. Pure (no RN imports) so scripts/check-csv.ts can run it under node.
import { parseExtrasDonationAmount } from '@/client/chzzk/protocol';
import { ANONYMOUS_DONOR } from '@/constants/chat-text';
import type { ExportRow } from '@/storage/log-repo';

/** Excel only reads Korean CSV as UTF-8 when the file starts with a BOM. */
export const CSV_BOM = '﻿';
const EOL = '\r\n';

const TYPE_LABEL: Record<string, string> = {
  text: '채팅',
  rich: '채팅',
  image: '이미지',
  sticker: '스티커',
  video: '영상',
  donation: '후원',
  subscription: '구독',
  system: '알림',
  blinded: '가려짐',
};

const HEADER = ['날짜', '시간', '닉네임', '종류', '메시지', '후원 금액'];

/**
 * One CSV cell. Chat text is attacker-controlled: a cell starting with = + - @ (or tab/CR) would
 * run as a formula when the file is opened in a spreadsheet, so it is prefixed with ' (OWASP).
 */
export function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function csvHeader(): string {
  return HEADER.map(csvCell).join(',') + EOL;
}

/** One archive row as a CSV line (local date and time, like the viewer shows). */
export function csvLine(row: ExportRow): string {
  const d = new Date(row.msg_time);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const donation = row.type === 'donation';
  // System notices (e.g. chat mode changes) have no sender.
  const nickname = row.type === 'system' ? '' : row.nickname || (donation ? ANONYMOUS_DONOR : '익명');
  const amount = donation ? parseExtrasDonationAmount(row.extras_json) : undefined;
  return (
    [date, time, nickname, TYPE_LABEL[row.type] ?? row.type, row.message, amount ? String(amount) : '']
      .map(csvCell)
      .join(',') + EOL
  );
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`chat-csv self-check failed: ${msg}`);
}

export function selfCheck(): void {
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
}
