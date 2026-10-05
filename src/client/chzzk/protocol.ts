import type { ChatMessage, ChatRole, MsgType } from './types';
import { splitEmoji } from './emoji';

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

export type CmdValue = (typeof Cmd)[keyof typeof Cmd];

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseExtras(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return isRecord(p) ? p : {};
    } catch {
      return {};
    }
  }
  return isRecord(v) ? v : {};
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

// Every CHZZK image (emoji packs, profile/channel images, subscription emojis) is served from
// Naver's pstatic.net CDN (checked against live responses). Sender-controlled URLs (extras.emojis)
// must not make every viewer fetch an arbitrary host, so anything else is dropped.
const TRUSTED_IMAGE = /^https:\/\/([a-z0-9-]+\.)*pstatic\.net\//i;

/** True for https URLs on the CHZZK/Naver image CDN. */
export function isTrustedImageUrl(url: unknown): url is string {
  return typeof url === 'string' && TRUSTED_IMAGE.test(url);
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
  return emojisFrom(parseExtras(extras));
}

function msgTypeFrom(code: unknown): MsgType {
  return (typeof code === 'number' && MSG_TYPE[code]) || 'text';
}

function safeParseObject(v: unknown): Record<string, unknown> {
  if (isRecord(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return isRecord(p) ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

function messageFromBdy(raw: Record<string, unknown>, chatChannelId: string): ChatMessage | null {
  const bdy = isRecord(raw.bdy) ? raw.bdy : {};
  const profile = safeParseObject(bdy.profile);

  const userIdHash = String(bdy.uid ?? bdy.userId ?? profile.userIdHash ?? '');
  const nickname = String(profile.nickname ?? bdy.nickname ?? '');
  const role = roleFrom(profile.userRoleCode ?? bdy.role);
  const msgType = msgTypeFrom(bdy.msgTypeCode ?? bdy.messageTypeCode);
  const extras = parseExtras(bdy.extras);
  const msgTime =
    typeof bdy.msgTime === 'number'
      ? bdy.msgTime
      : typeof bdy.messageTime === 'number'
        ? bdy.messageTime
        : 0;

  const amount = extras.payAmount ?? extras.donationAmount;
  const donationAmount =
    msgType === 'donation' && typeof amount === 'string'
      ? Number(amount.replace(/[^\d]/g, '')) || undefined
      : typeof amount === 'number'
        ? amount
        : undefined;

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

export function parseChatMessage(raw: unknown): ChatMessage | null {
  return parseChatMessages(raw)[0] ?? null;
}

export function parseChatMessages(raw: unknown): ChatMessage[] {
  if (!isRecord(raw) || typeof raw.cmd !== 'number') return [];
  if (raw.cmd !== Cmd.CHAT && raw.cmd !== Cmd.DONATION && raw.cmd !== Cmd.NOTICE) return [];
  if (typeof raw.cid !== 'string') return [];

  // Live frames (cmd 93101/93102) carry `bdy` as an ARRAY of message objects, one per chat.
  const bdy = raw.bdy;
  if (Array.isArray(bdy)) {
    const out: ChatMessage[] = [];
    for (const item of bdy) {
      if (!isRecord(item)) continue;
      const m = messageFromBdy({ ...raw, bdy: item }, raw.cid);
      if (m) out.push(m);
    }
    return out;
  }
  const m = messageFromBdy(raw, raw.cid);
  return m ? [m] : [];
}

/** A message hidden after it was sent; identifies it by sender + send time. */
export interface BlindEvent {
  messageTime: number;
  userIdHash: string;
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
  return list
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => messageFromBdy({ ...raw, bdy: item }, cid))
    .filter((m): m is ChatMessage => m !== null);
}

export function selfCheck(): void {
  const assert = (cond: boolean, label: string) => {
    if (!cond) throw new Error(`protocol self-check failed: ${label}`);
  };

  const c = connectMessage('abc', { accTkn: 't', uid: 'u1' });
  assert(c.ver === '2' && c.cmd === Cmd.CONNECT && c.cid === 'abc' && c.svcid === 'game', 'connect base');
  assert(c.bdy.uid === 'u1' && c.bdy.auth === 'SEND' && c.bdy.accTkn === 't', 'connect send');

  const readOnly = connectMessage('abc', { accTkn: 't' });
  assert(readOnly.bdy.auth === 'READ' && readOnly.bdy.uid === null, 'connect read-only');

  const chat = parseChatMessage({
    ver: '2',
    cmd: Cmd.CHAT,
    cid: 'abc',
    bdy: {
      uid: 'hash',
      msgTime: 1700000000000,
      msgTypeCode: 1,
      extras: '{"badge":[]}',
      msg: 'hello',
      profile: JSON.stringify({ userIdHash: 'hash', nickname: 'nick', userRoleCode: 'common_user' }),
    },
  });
  assert(chat?.message === 'hello' && chat.nickname === 'nick' && chat.role === 'member', 'chat parse');
  assert(chat?.msgType === 'text' && chat.chatChannelId === 'abc', 'chat meta');

  const dono = parseChatMessage({
    ver: '2',
    cmd: Cmd.DONATION,
    cid: 'abc',
    bdy: {
      msgTime: 1700000000000,
      msgTypeCode: 10,
      extras: JSON.stringify({ payAmount: '5000' }),
      msg: 'thanks',
      profile: JSON.stringify({ userIdHash: 'h2', nickname: 'yuna', userRoleCode: 'streaming_chat_manager' }),
    },
  });
  assert(dono?.msgType === 'donation' && dono.donationAmount === 5000, 'donation parse');
  assert(dono?.role === 'manager', 'donation role');

  const notice = parseChatMessage({
    ver: '2',
    cmd: Cmd.NOTICE,
    cid: 'abc',
    bdy: { noticeMessage: '공지', nickname: 'host', role: 'streamer' },
  });
  assert(notice?.message === '공지' && notice.role === 'streamer', 'notice parse');

  // Live chat frames carry bdy as an ARRAY of message objects.
  const live = parseChatMessages({
    ver: '1',
    cmd: Cmd.CHAT,
    tid: '3',
    cid: 'abc',
    bdy: [
      {
        uid: 'u1',
        msg: 'hello',
        msgTypeCode: 1,
        msgTime: 1700000003000,
        profile: JSON.stringify({
          userIdHash: 'u1',
          nickname: '쒼만두',
          userRoleCode: 'common_user',
          profileImageUrl: 'https://nng-phinf.pstatic.net/x/1.png',
        }),
      },
      {
        uid: 'u2',
        msg: 'second',
        msgTypeCode: 10,
        msgTime: 1700000004000,
        extras: JSON.stringify({ payAmount: '3000' }),
        profile: JSON.stringify({ userIdHash: 'u2', nickname: 'yuna', userRoleCode: 'streaming_chat_manager' }),
      },
    ],
  });
  assert(live.length === 2, 'live array parse');
  assert(live[0].nickname === '쒼만두' && live[0].message === 'hello' && live[0].msgTime === 1700000003000, 'live first');
  assert(live[0].profileImageUrl === 'https://nng-phinf.pstatic.net/x/1.png', 'live profile image');
  assert(live[1].msgType === 'donation' && live[1].donationAmount === 3000 && live[1].role === 'manager', 'live second');

  // Subscription emojis ride in each message's extras.emojis (verified against a raw frame).
  const subEmoji = parseChatMessage({
    cmd: Cmd.CHAT,
    cid: 'abc',
    bdy: {
      uid: 'u3',
      msg: '{:yasiroDdam:}',
      msgTypeCode: 1,
      extras: JSON.stringify({
        emojis: {
          yasiroDdam: 'https://nng-phinf.pstatic.net/ddam.png',
          bad: 'javascript:1',
          evil: 'https://attacker.example/p.png',
          spoof: 'https://pstatic.net.attacker.example/p.png',
        },
      }),
      profile: JSON.stringify({ nickname: 'n' }),
    },
  });
  assert(subEmoji?.emojis?.yasiroDdam === 'https://nng-phinf.pstatic.net/ddam.png', 'extras emojis parse');
  assert(subEmoji?.emojis?.bad === undefined, 'extras emojis reject non-https');
  assert(subEmoji?.emojis?.evil === undefined && subEmoji?.emojis?.spoof === undefined, 'extras emojis reject foreign hosts');
  assert(
    parseExtrasEmojis('{"emojis":{"a":"https://ssl.pstatic.net/a.png"}}')?.a === 'https://ssl.pstatic.net/a.png',
    'stored extras emojis',
  );
  assert(parseExtrasEmojis('not json') === undefined, 'stored extras garbage');

  const recent = parseRecentChat({
    ver: '2',
    cmd: Cmd.RECENT_CHAT,
    cid: 'abc',
    bdy: {
      recentMessageCount: 2,
      messageList: [
        {
          userId: 'a',
          messageTime: 1700000001000,
          messageTypeCode: 1,
          msg: 'one',
          profile: JSON.stringify({ userIdHash: 'a', nickname: 'A' }),
        },
        {
          userId: 'b',
          messageTime: 1700000002000,
          messageTypeCode: 1,
          content: 'two',
          profile: JSON.stringify({ userIdHash: 'b', nickname: 'B' }),
        },
      ],
    },
  });
  assert(recent.length === 2 && recent[1].message === 'two', 'recent parse');
  assert(recent[0].msgTime === 1700000001000 && recent[1].userIdHash === 'b', 'recent field names');

  const blind = parseBlind({
    svcid: 'game',
    ver: '1',
    bdy: { messageTime: 1791173111049, blindType: 'BLIND', blindUserId: null, serviceId: 'game', message: null, userId: 'u9', channelId: 'abc' },
    cmd: Cmd.BLIND,
    tid: null,
    cid: 'abc',
  });
  assert(blind?.messageTime === 1791173111049 && blind.userIdHash === 'u9', 'blind parse');
  assert(parseBlind({ cmd: Cmd.BLIND, bdy: { messageTime: 1 } }) === null, 'blind without user ignored');

  const send = sendChatMessage(
    'abc',
    'hi',
    123,
    { chatType: 'STREAMING', emojis: {}, osType: 'PC', extraToken: 'xt', streamingChannelId: 'ch1' },
    'sid1',
  );
  assert(send.cmd === Cmd.SEND_CHAT && send.bdy.msg === 'hi' && send.sid === 'sid1', 'send encode');
  const sentExtras = JSON.parse(String(send.bdy.extras)) as Record<string, unknown>;
  assert(sentExtras.extraToken === 'xt' && sentExtras.streamingChannelId === 'ch1', 'send extras');
  assert(pingMessage('abc').cmd === Cmd.PING, 'ping encode');
  assert(pongMessage().cmd === Cmd.PONG, 'pong encode');
  const rec = recentChatMessage('abc', 'sid1');
  assert(rec.cmd === Cmd.REQUEST_RECENT_CHAT && rec.sid === 'sid1' && rec.bdy.recentMessageCount === 50, 'recent encode');

  const seg = splitEmoji('hi {:d_1:} bye {:unknown:}', { d_1: 'https://x/1.png' });
  assert(seg.length === 4, 'emoji split count');
  assert(seg[1].emojiId === 'd_1' && seg[1].imageUrl === 'https://x/1.png', 'emoji image lookup');
  assert(seg[3].text === '{:unknown:}', 'unknown emoji kept as text');
  const own = splitEmoji('{:sub_1:}', {}, { sub_1: 'https://x/s.png' });
  assert(own[0].imageUrl === 'https://x/s.png', 'message emoji lookup');
}
