export type LiveStatusValue = 'OPEN' | 'CLOSE';

export interface ChannelDetail {
  channelId: string;
  channelName: string;
  channelImageUrl: string;
  followerCount: number;
  verifiedMark: boolean;
  openLive: boolean;
}

export interface SearchChannel {
  channel: ChannelDetail;
}

export interface LiveStatus {
  channelId: string;
  status: LiveStatusValue;
  concurrentUserCount: number;
  chatChannelId: string;
}

export interface AccessToken {
  accessToken: string;
  extraToken: string;
  realNameAuth: boolean;
  temporaryRestrict?: { temporaryRestrict: boolean; times: number } | null;
}

export interface UserStatus {
  userIdHash: string;
  loggedIn: boolean;
}

export type ChatRole = 'streamer' | 'manager' | 'member';

export type MsgType =
  | 'text'
  | 'image'
  | 'sticker'
  | 'video'
  | 'rich'
  | 'donation'
  | 'subscription'
  | 'system';

export interface ChatMessage {
  chatChannelId: string;
  userIdHash: string;
  nickname: string;
  profileImageUrl?: string;
  message: string;
  msgType: MsgType;
  role: ChatRole;
  msgTime: number;
  extras: Record<string, unknown>;
  donationAmount?: number;
}
