import { isRecord, isTrustedImageUrl } from './guards';
import type { AccessToken, ChannelDetail, LiveStatus, SearchChannel, UserStatus } from './types';

const SERVICE_BASE = 'https://api.chzzk.naver.com';
const GAME_BASE = 'https://comm-api.game.naver.com/nng_main';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export class ChzzkApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(message);
  }
}

// RN Android's OkHttp client has no connect/read timeouts, so a half-open connection (network
// switch, NAT expiry) would leave a request pending forever and everything awaiting it stuck.
const REQUEST_TIMEOUT_MS = 15000;

// Response bodies are untrusted input: every endpoint below parses `content` (unknown) into its
// type, checking what downstream code relies on, instead of casting.
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function unexpected(what: string): never {
  throw new ChzzkApiError(`unexpected ${what} response`, -1);
}

function qs(params: Record<string, string | number>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

async function request(
  base: string,
  path: string,
  opts: { params?: Record<string, string | number>; cookie?: string; method?: 'GET' | 'POST' | 'DELETE' | 'PUT'; body?: unknown } = {},
): Promise<unknown> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await send(base + path + qs(opts.params ?? {}), opts, abort.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function send(
  url: string,
  opts: { cookie?: string; method?: 'GET' | 'POST' | 'DELETE' | 'PUT'; body?: unknown },
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    signal,
    // Keep the shared native cookie jar (= login WebView store on Android) out of API calls:
    // with credentials, RN Android attaches the jar's NID cookies even when we pass none
    // (and OkHttp's jar header can win over ours). The explicit header below is the only auth.
    credentials: 'omit',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Referer: 'https://chzzk.naver.com/',
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const body: unknown = await res.json();
  if (!isRecord(body)) unexpected('api');
  if (body.code !== 200) {
    throw new ChzzkApiError(str(body.message) || 'chzzk api error', num(body.code, -1));
  }
  return body.content;
}

// Path segments come from deep links (chaat://chat/<id>) and server frames. Encode every one, and
// require the channel id shape before any request (some of these carry the user's cookie), so a
// crafted id can't steer an authenticated request to another API path.
const CHANNEL_ID = /^[0-9a-f]{32}$/;

/** A CHZZK channel id (32 hex chars). Route params from deep links are checked with this. */
export function isChannelId(v: unknown): v is string {
  return typeof v === 'string' && CHANNEL_ID.test(v);
}

function channelPath(channelId: string): string {
  if (!isChannelId(channelId)) throw new ChzzkApiError('invalid channel id', 400);
  return encodeURIComponent(channelId);
}

// Image URLs from REST go straight into <Image>; keep them on the CHZZK CDN like WS-sourced ones.
function parseChannel(v: unknown): ChannelDetail | null {
  if (!isRecord(v) || typeof v.channelId !== 'string') return null;
  return {
    channelId: v.channelId,
    channelName: str(v.channelName),
    channelImageUrl: isTrustedImageUrl(v.channelImageUrl) ? v.channelImageUrl : '',
    followerCount: num(v.followerCount),
    verifiedMark: v.verifiedMark === true,
    openLive: v.openLive === true,
  };
}

export interface SearchResult {
  data: SearchChannel[];
  nextOffset: number | null;
}

export function searchChannels(
  keyword: string,
  opts: { size?: number; offset?: number } = {},
): Promise<SearchResult> {
  return request(SERVICE_BASE, '/service/v1/search/channels', {
    params: { keyword, size: opts.size ?? 20, offset: opts.offset ?? 0 },
  }).then((c) => {
    if (!isRecord(c)) unexpected('search');
    const data: SearchChannel[] = [];
    for (const d of arr(c.data)) {
      const channel = isRecord(d) ? parseChannel(d.channel) : null;
      if (channel) data.push({ channel });
    }
    const next = isRecord(c.page) && isRecord(c.page.next) ? c.page.next.offset : null;
    return { data, nextOffset: typeof next === 'number' ? next : null };
  });
}

/**
 * The answer depends on the viewer (it carries userAdultStatus): pass the session cookie, or an
 * age-restricted stream comes back without its chatChannelId.
 */
export async function getLiveStatus(channelId: string, cookie?: string): Promise<LiveStatus> {
  return request(SERVICE_BASE, `/polling/v2/channels/${channelPath(channelId)}/live-status`, { cookie }).then((c) => {
    // A channel that has never streamed answers code 200 with content: null (verified against
    // a raw response): no live, no chat room — not an error.
    if (c === null) return { channelId, status: 'CLOSE', concurrentUserCount: 0, chatChannelId: null, adult: false };
    if (!isRecord(c)) unexpected('live-status');
    return {
      channelId,
      status: c.status === 'OPEN' ? 'OPEN' : 'CLOSE',
      concurrentUserCount: num(c.concurrentUserCount),
      // Validated here so nothing downstream opens a socket for a null/empty chat room id.
      chatChannelId: typeof c.chatChannelId === 'string' && c.chatChannelId.length > 0 ? c.chatChannelId : null,
      adult: c.adult === true,
    };
  });
}

export async function getChannel(channelId: string): Promise<ChannelDetail> {
  // content IS the channel (verified against a raw response), not wrapped in { channel }.
  return request(SERVICE_BASE, `/service/v1/channels/${channelPath(channelId)}`).then(
    (c) => parseChannel(c) ?? unexpected('channel'),
  );
}

export function getAccessToken(chatChannelId: string, cookie?: string): Promise<AccessToken> {
  return request(GAME_BASE, '/v1/chats/access-token', { params: { channelId: chatChannelId, chatType: 'STREAMING' }, cookie }).then(
    (c) => {
      if (!isRecord(c) || typeof c.accessToken !== 'string' || !c.accessToken) unexpected('access-token');
      return { accessToken: c.accessToken, extraToken: str(c.extraToken), realNameAuth: c.realNameAuth === true };
    },
  );
}

/** The user hash becomes the socket uid and gates sending; a session without one isn't signed in. */
export function getUserStatus(cookie: string): Promise<UserStatus> {
  return request(GAME_BASE, '/v1/user/getUserStatus', { cookie }).then((c) => {
    if (!isRecord(c)) unexpected('user-status');
    const userIdHash = str(c.userIdHash);
    return { userIdHash, loggedIn: c.loggedIn === true && userIdHash.length > 0 };
  });
}

/** Body of a moderator action on one chat (post/clear notice, blind). */
export interface ChatActionPayload {
  message: string;
  messageTime: number;
  messageUserIdHash: string;
  streamingChannelId: string;
}

export type ChatAction = 'postNotice' | 'clearNotice' | 'blind';

const CHAT_ACTION = {
  postNotice: { method: 'POST', path: '/v1/chats/notices' },
  clearNotice: { method: 'DELETE', path: '/v1/chats/notices' },
  blind: { method: 'POST', path: '/v1/chats/blind-message' },
} as const;

export async function chatAction(action: ChatAction, chatChannelId: string, cookie: string, p: ChatActionPayload): Promise<void> {
  const { method, path } = CHAT_ACTION[action];
  await request(GAME_BASE, path, { method, cookie, body: { channelId: chatChannelId, chatType: 'STREAMING', ...p } });
}

export interface ProfileCard {
  userIdHash: string;
  nickname: string;
  profileImageUrl: string | null;
  userRoleCode: string;
  verifiedMark: boolean;
  activityBadges: { badgeId: string; title: string; description: string; activated: boolean }[];
  streamingProperty: {
    subscription?: { accumulativeMonth: number; tierName: string };
    following?: { followDate: string };
    nicknameColor?: { colorCode: string };
  };
}

export function getProfileCard(chatChannelId: string, userIdHash: string, cookie?: string): Promise<ProfileCard> {
  return request(
    GAME_BASE,
    `/v1/chats/${encodeURIComponent(chatChannelId)}/users/${encodeURIComponent(userIdHash)}/profile-card`,
    { params: { chatType: 'STREAMING' }, cookie },
  ).then((pc) => {
    if (!isRecord(pc)) unexpected('profile-card');
    // streamingProperty and its parts are optional/nullable in practice; the screen reads them.
    const sp = isRecord(pc.streamingProperty) ? pc.streamingProperty : {};
    const sub = isRecord(sp.subscription) ? sp.subscription : null;
    const follow = isRecord(sp.following) ? sp.following : null;
    const color = isRecord(sp.nicknameColor) ? sp.nicknameColor : null;
    return {
      userIdHash: str(pc.userIdHash, userIdHash),
      nickname: str(pc.nickname),
      profileImageUrl: isTrustedImageUrl(pc.profileImageUrl) ? pc.profileImageUrl : null,
      userRoleCode: str(pc.userRoleCode),
      verifiedMark: pc.verifiedMark === true,
      activityBadges: arr(pc.activityBadges).flatMap((b) =>
        isRecord(b)
          ? [{ badgeId: str(b.badgeId), title: str(b.title), description: str(b.description), activated: b.activated === true }]
          : [],
      ),
      streamingProperty: {
        ...(sub ? { subscription: { accumulativeMonth: num(sub.accumulativeMonth), tierName: str(sub.tierName) } } : {}),
        ...(follow && typeof follow.followDate === 'string' ? { following: { followDate: follow.followDate } } : {}),
        ...(color && typeof color.colorCode === 'string' ? { nicknameColor: { colorCode: color.colorCode } } : {}),
      },
    };
  });
}

// Packs come in three lists, each pack holding up to three emoji lists; only id + an image on the
// CHZZK CDN survive.
const PACK_LISTS = ['emojiPacks', 'cheatKeyEmojiPacks', 'subscriptionEmojiPacks'] as const;
const PACK_EMOJIS = ['emojis', 'tier1Emojis', 'tier2Emojis'] as const;

export async function getEmojiPacks(channelId: string, cookie?: string): Promise<{ emojiId: string; imageUrl: string }[]> {
  return request(SERVICE_BASE, `/service/v1/channels/${channelPath(channelId)}/emoji-packs`, { cookie }).then((c) => {
    if (!isRecord(c)) unexpected('emoji-packs');
    const out: { emojiId: string; imageUrl: string }[] = [];
    for (const list of PACK_LISTS) {
      for (const pack of arr(c[list])) {
        if (!isRecord(pack)) continue;
        for (const key of PACK_EMOJIS) {
          for (const e of arr(pack[key])) {
            if (isRecord(e) && typeof e.emojiId === 'string' && isTrustedImageUrl(e.imageUrl)) {
              out.push({ emojiId: e.emojiId, imageUrl: e.imageUrl });
            }
          }
        }
      }
    }
    return out;
  });
}
