import { isTrustedImageUrl } from './protocol';
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

function qs(params: Record<string, string | number>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

async function get<T>(
  base: string,
  path: string,
  params: Record<string, string | number>,
  cookie?: string,
): Promise<T> {
  return request<T>(base, path, { params, cookie });
}

async function request<T>(
  base: string,
  path: string,
  opts: { params?: Record<string, string | number>; cookie?: string; method?: 'GET' | 'POST' | 'DELETE' | 'PUT'; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(base + path + qs(opts.params ?? {}), {
    method: opts.method ?? 'GET',
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
  const body = (await res.json()) as { code: number; message: string; content: T };
  if (body.code !== 200) {
    throw new ChzzkApiError(body.message || 'chzzk api error', body.code);
  }
  return body.content;
}

// Image URLs from REST go straight into <Image>; keep them on the CHZZK CDN like WS-sourced ones.
function trustedChannel(c: ChannelDetail): ChannelDetail {
  return isTrustedImageUrl(c.channelImageUrl) ? c : { ...c, channelImageUrl: '' };
}

export interface SearchResult {
  data: SearchChannel[];
  nextOffset: number | null;
}

export function searchChannels(
  keyword: string,
  opts: { size?: number; offset?: number } = {},
): Promise<SearchResult> {
  return get<{ data: SearchChannel[]; page: { next: { offset: number } | null } }>(
    SERVICE_BASE,
    '/service/v1/search/channels',
    {
      keyword,
      size: opts.size ?? 20,
      offset: opts.offset ?? 0,
    },
  ).then((c) => ({
    data: c.data.map((d) => ({ ...d, channel: trustedChannel(d.channel) })),
    nextOffset: c.page.next?.offset ?? null,
  }));
}

export function getLiveStatus(channelId: string): Promise<LiveStatus> {
  return get<LiveStatus>(
    SERVICE_BASE,
    `/polling/v2/channels/${channelId}/live-status`,
    {},
  );
}

export function getChannel(channelId: string): Promise<ChannelDetail> {
  // content IS the channel (verified against a raw response), not wrapped in { channel }.
  return get<ChannelDetail>(SERVICE_BASE, `/service/v1/channels/${channelId}`, {}).then(trustedChannel);
}

export function getAccessToken(chatChannelId: string, cookie?: string): Promise<AccessToken> {
  return get<AccessToken>(GAME_BASE, '/v1/chats/access-token', {
    channelId: chatChannelId,
    chatType: 'STREAMING',
  }, cookie);
}

export function getUserStatus(cookie: string): Promise<UserStatus> {
  return get<UserStatus>(GAME_BASE, '/v1/user/getUserStatus', {}, cookie);
}

export interface NoticePayload {
  message: string;
  messageTime: number;
  messageUserIdHash: string;
  streamingChannelId: string;
}

export async function postNotice(chatChannelId: string, cookie: string, p: NoticePayload): Promise<void> {
  await request<void>(GAME_BASE, '/v1/chats/notices', {
    method: 'POST',
    cookie,
    body: { channelId: chatChannelId, chatType: 'STREAMING', ...p },
  });
}

export async function deleteNotice(chatChannelId: string, cookie: string, p: NoticePayload): Promise<void> {
  await request<void>(GAME_BASE, '/v1/chats/notices', {
    method: 'DELETE',
    cookie,
    body: { channelId: chatChannelId, chatType: 'STREAMING', ...p },
  });
}

export async function blindMessage(chatChannelId: string, cookie: string, p: NoticePayload): Promise<void> {
  await request<void>(GAME_BASE, '/v1/chats/blind-message', {
    method: 'POST',
    cookie,
    body: { channelId: chatChannelId, chatType: 'STREAMING', ...p },
  });
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
  return get<ProfileCard>(
    GAME_BASE,
    `/v1/chats/${chatChannelId}/users/${userIdHash}/profile-card`,
    { chatType: 'STREAMING' },
    cookie,
  ).then((pc) => (isTrustedImageUrl(pc.profileImageUrl) ? pc : { ...pc, profileImageUrl: null }));
}

export interface EmojiPack {
  emojiPackId: string;
  emojiPackName: string;
  emojiPackLocked?: boolean;
  emojis: { emojiId: string; imageUrl: string }[];
  tier1Emojis?: { emojiId: string; imageUrl: string }[];
  tier2Emojis?: { emojiId: string; imageUrl: string }[];
}

interface EmojiPacksContent {
  emojiPacks: EmojiPack[];
  cheatKeyEmojiPacks?: EmojiPack[];
  subscriptionEmojiPacks?: EmojiPack[];
}

export function getEmojiPacks(channelId: string, cookie?: string): Promise<{ emojiId: string; imageUrl: string }[]> {
  return get<EmojiPacksContent>(SERVICE_BASE, `/service/v1/channels/${channelId}/emoji-packs`, {}, cookie).then((c) => {
    const all = [...c.emojiPacks, ...(c.cheatKeyEmojiPacks ?? []), ...(c.subscriptionEmojiPacks ?? [])];
    return all
      .flatMap((p) => [...p.emojis, ...(p.tier1Emojis ?? []), ...(p.tier2Emojis ?? [])])
      .filter((e) => isTrustedImageUrl(e.imageUrl));
  });
}
