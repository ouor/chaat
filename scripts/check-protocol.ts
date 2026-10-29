import {
  Cmd,
  connectMessage,
  parseBlind,
  parseChatMessages,
  parseConnected,
  parseExtrasEmojis,
  parseRecentChat,
  pingMessage,
  pongMessage,
  recentChatMessage,
  sendChatMessage,
} from '../src/client/chzzk/protocol';

const assert = (cond: boolean, label: string) => {
  if (!cond) throw new Error(`protocol self-check failed: ${label}`);
};

const c = connectMessage('abc', { accTkn: 't', uid: 'u1' });
assert(c.ver === '2' && c.cmd === Cmd.CONNECT && c.cid === 'abc' && c.svcid === 'game', 'connect base');
assert(c.bdy.uid === 'u1' && c.bdy.auth === 'SEND' && c.bdy.accTkn === 't', 'connect send');

const readOnly = connectMessage('abc', { accTkn: 't' });
assert(readOnly.bdy.auth === 'READ' && readOnly.bdy.uid === null, 'connect read-only');

const [chat] = parseChatMessages({
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

const [dono] = parseChatMessages({
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

const [notice] = parseChatMessages({
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
const [subEmoji] = parseChatMessages({
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
assert(parseConnected({ cmd: Cmd.CONNECTED, bdy: { sid: 'S1' } })?.sid === 'S1', 'connected parse');
assert(parseConnected({ cmd: Cmd.CHAT }) === null, 'connected wrong cmd');
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

console.log('protocol self-check: ok');
