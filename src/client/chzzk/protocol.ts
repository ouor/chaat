import { isRecord, isTrustedImageUrl, parseObject } from './guards';
import type { ChatMessage, ChatRole, MsgType } from './types';

export const Cmd = {
  PING: 0,
  PONG: 10000,
  CONNECT: 100,
  CONNECTED: 10100,
  SEND_CHAT: 3101,
  REQUEST_RECENT_CHAT: 5101,
  RECENT_CHAT: 15101,
  CHAT: 93101,
  DONATION: 93102,
  BLIND: 94008,
  NOTICE: 94010,
} as const;

const MSG_TYPE: Record<number, MsgType> = {
  1: 'text',
  2: 'image',
  3: 'sticker',
  4: 'video',
  5: 'rich',
  10: 'donation',
  11: 'subscription',
  30: 'system',
};

const ROLE: Record<number, ChatRole> = { 1: 'member', 2: 'manager', 3: 'streamer' };

export interface WsMessage {
  ver: string;
  cmd: number;
  svcid: string;
  cid: string;
  bdy: Record<string, unknown>;
  tid?: number;
  sid?: string;
  retry?: boolean;
}

function base(cmd: number, cid: string): WsMessage {
  return { ver: '2', cmd, svcid: 'game', cid, bdy: {} };
}

export function connectMessage(
  cid: string,
  opts: { accTkn: string; uid?: string },
): WsMessage {
  return {
    ...base(Cmd.CONNECT, cid),
    tid: 1,
    bdy: {
      uid: opts.uid ?? null,
      devType: 2001,
      auth: opts.uid ? 'SEND' : 'READ',
      accTkn: opts.accTkn,
    },
  };
}

/**
 * Extras every outgoing chat must carry. Verified against live frames sent by the official PC/AOS
 * clients: without extraToken, or with the chat room id as streamingChannelId, the server acks the
 * send (13101 SUCCESS) and then immediately blinds it (94008).
 */
export interface SendChatExtras {
  chatType: 'STREAMING';
  emojis: Record<string, string>;
  osType: 'PC';
  /** From the access-token response, alongside accessToken. */
  extraToken: string;
  /** The streamer's channel id (not the chat room id). */
  streamingChannelId: string;
}

export function sendChatMessage(
  cid: string,
  msg: string,
  msgTime: number,
  extras: SendChatExtras,
  sid?: string,
): WsMessage {
  return {
    ...base(Cmd.SEND_CHAT, cid),
    retry: false,
    sid,
    tid: 3,
    bdy: { extras: JSON.stringify(extras), msg, msgTime, msgTypeCode: 1 },
  };
}

export function recentChatMessage(cid: string, sid: string, recentMessageCount = 50): WsMessage {
  return {
    ...base(Cmd.REQUEST_RECENT_CHAT, cid),
    sid,
    tid: 2,
    bdy: { recentMessageCount },
  };
}

export function pingMessage(cid: string): WsMessage {
  return { ...base(Cmd.PING, cid), bdy: {} };
}

export function pongMessage(): { cmd: number; ver: string } {
  return { cmd: Cmd.PONG, ver: '2' };
}

const ROLE_NAME: Record<string, ChatRole> = {
  member: 'member',
  manager: 'manager',
  streamer: 'streamer',
  common_user: 'member',
  streaming_chat_manager: 'manager',
  streaming_channel_manager: 'manager',
};

function roleFrom(v: unknown): ChatRole {
  if (typeof v === 'number' && ROLE[v]) return ROLE[v];
  if (typeof v === 'string' && ROLE_NAME[v]) return ROLE_NAME[v];
  return 'member';
}

function emojisFrom(extras: Record<string, unknown>): Record<string, string> | undefined {
  if (!isRecord(extras.emojis)) return undefined;
  const out: Record<string, string> = {};
  for (const [id, url] of Object.entries(extras.emojis)) {
    if (isTrustedImageUrl(url)) out[id] = url;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Sender emoji map from a raw or stored extras value (stored logs keep extras as JSON text). */
export function parseExtrasEmojis(extras: unknown): Record<string, string> | undefined {
  return emojisFrom(parseObject(extras));
}

function donationAmountFrom(extras: Record<string, unknown>): number | undefined {
  const amount = extras.payAmount ?? extras.donationAmount;
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') return Number(amount.replace(/[^\d]/g, '')) || undefined;
  return undefined;
}

/** Donation amount (cheese) from a raw or stored extras value. */
export function parseExtrasDonationAmount(extras: unknown): number | undefined {
  return donationAmountFrom(parseObject(extras));
}

function msgTypeFrom(code: unknown): MsgType {
  return (typeof code === 'number' && MSG_TYPE[code]) || 'text';
}

function messageFromBdy(raw: Record<string, unknown>, chatChannelId: string): ChatMessage {
  const bdy = isRecord(raw.bdy) ? raw.bdy : {};
  const profile = parseObject(bdy.profile);

  const userIdHash = String(bdy.uid ?? bdy.userId ?? profile.userIdHash ?? '');
  const nickname = String(profile.nickname ?? bdy.nickname ?? '');
  const role = roleFrom(profile.userRoleCode ?? bdy.role);
  const msgType = msgTypeFrom(bdy.msgTypeCode ?? bdy.messageTypeCode);
  const extras = parseObject(bdy.extras);
  const msgTime =
    typeof bdy.msgTime === 'number'
      ? bdy.msgTime
      : typeof bdy.messageTime === 'number'
        ? bdy.messageTime
        : 0;

  const donationAmount = msgType === 'donation' ? donationAmountFrom(extras) : undefined;

  return {
    chatChannelId,
    userIdHash,
    nickname,
    profileImageUrl: isTrustedImageUrl(profile.profileImageUrl) ? profile.profileImageUrl : undefined,
    message: String(bdy.msg ?? bdy.content ?? bdy.noticeMessage ?? ''),
    msgType,
    role,
    msgTime,
    extras,
    donationAmount,
    emojis: emojisFrom(extras),
  };
}

export function parseChatMessages(raw: unknown): ChatMessage[] {
  if (!isRecord(raw) || typeof raw.cmd !== 'number') return [];
  if (raw.cmd !== Cmd.CHAT && raw.cmd !== Cmd.DONATION && raw.cmd !== Cmd.NOTICE) return [];
  if (typeof raw.cid !== 'string') return [];

  // Live frames (cmd 93101/93102) carry `bdy` as an ARRAY of message objects, one per chat.
  const bdy = raw.bdy;
  if (Array.isArray(bdy)) {
    const cid = raw.cid;
    return bdy.filter(isRecord).map((item) => messageFromBdy({ ...raw, bdy: item }, cid));
  }
  return [messageFromBdy(raw, raw.cid)];
}

/** CONNECTED (10100) ack; sid is required for recent-chat and send. */
export function parseConnected(raw: unknown): { sid?: string } | null {
  if (!isRecord(raw) || raw.cmd !== Cmd.CONNECTED) return null;
  const bdy = isRecord(raw.bdy) ? raw.bdy : {};
  return { sid: typeof bdy.sid === 'string' && bdy.sid ? bdy.sid : undefined };
}

/** A message hidden after it was sent; identifies it by sender + send time. */
export interface BlindEvent {
  messageTime: number;
  userIdHash: string;
}

/** True when `e` blinds `m` (the server names the message only by its time and sender). */
export function isBlindTarget(m: { msgTime: number; userIdHash: string }, e: BlindEvent): boolean {
  return m.msgTime === e.messageTime && m.userIdHash === e.userIdHash;
}

/**
 * Identity of one chat: a reconnect replays recent chats, and these fields are what stays the same.
 * The archive's unique index (db.ts) is on the same fields.
 */
export function chatKey(m: Pick<ChatMessage, 'msgTime' | 'userIdHash' | 'message'>): string {
  return `${m.msgTime}:${m.userIdHash}:${m.message}`;
}

// Shape verified against a live 94008 frame:
// {"cmd":94008,"bdy":{"messageTime":<ms>,"blindType":"BLIND","blindUserId":null,"message":null,"userId":"<hash>",...}}
export function parseBlind(raw: unknown): BlindEvent | null {
  if (!isRecord(raw) || raw.cmd !== Cmd.BLIND || !isRecord(raw.bdy)) return null;
  const { messageTime, userId } = raw.bdy;
  if (typeof messageTime !== 'number' || typeof userId !== 'string' || !userId) return null;
  return { messageTime, userIdHash: userId };
}

export function parseRecentChat(raw: unknown): ChatMessage[] {
  if (!isRecord(raw) || raw.cmd !== Cmd.RECENT_CHAT || typeof raw.cid !== 'string') return [];
  const cid = raw.cid;
  const bdy = isRecord(raw.bdy) ? raw.bdy : {};
  const list = Array.isArray(bdy.messageList) ? bdy.messageList : [];
  return list.filter(isRecord).map((item) => messageFromBdy({ ...raw, bdy: item }, cid));
}
