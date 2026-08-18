import type { AccessToken, LiveStatus, SearchChannel, UserStatus } from './types';

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
  const res = await fetch(base + path + qs(params), {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Referer: 'https://chzzk.naver.com/',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const body = (await res.json()) as { code: number; message: string; content: T };
  if (body.code !== 200) {
    throw new ChzzkApiError(body.message || 'chzzk api error', body.code);
  }
  return body.content;
}

export function searchChannels(
  keyword: string,
  opts: { size?: number; offset?: number } = {},
): Promise<SearchChannel[]> {
  return get<{ data: SearchChannel[] }>(SERVICE_BASE, '/service/v1/search/channels', {
    keyword,
    size: opts.size ?? 20,
    offset: opts.offset ?? 0,
  }).then((c) => c.data);
}

export function getLiveStatus(channelId: string): Promise<LiveStatus> {
  return get<LiveStatus>(
    SERVICE_BASE,
    `/polling/v2/channels/${channelId}/live-status`,
    {},
  );
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
