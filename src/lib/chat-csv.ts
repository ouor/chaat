// Archive rows -> CSV text. Pure (no RN imports) so scripts/check-csv.ts can run it under node.
import { parseExtrasDonationAmount } from '@/client/chzzk/protocol';
import { displayNickname } from '@/constants/chat-text';
import type { ExportRow } from '@/storage/log-repo';

import { pad2 } from './time';

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

export function csvHeader(): string {
  return HEADER.map(csvCell).join(',') + EOL;
}

/** One archive row as a CSV line (local date and time, like the viewer shows). */
export function csvLine(row: ExportRow): string {
  const d = new Date(row.msg_time);
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const donation = row.type === 'donation';
  // System notices (e.g. chat mode changes) have no sender.
  const nickname = row.type === 'system' ? '' : displayNickname(row.nickname, row.type);
  const amount = donation ? parseExtrasDonationAmount(row.extras_json) : undefined;
  return (
    [date, time, nickname, TYPE_LABEL[row.type] ?? row.type, row.message, amount ? String(amount) : '']
      .map(csvCell)
      .join(',') + EOL
  );
}
