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
  /** null for channels without a chat room (never streamed, age-restricted, ...). */
  chatChannelId: string | null;
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
  /** Set when a moderator / the clean bot blinded this message after it arrived. */
  blinded?: boolean;
  /** Sender's own emoji id -> image URL (subscription emojis aren't in the channel pack list). */
  emojis?: Record<string, string>;
}
