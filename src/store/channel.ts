import { useEffect, useState } from 'react';

import {
  blindMessage,
  deleteNotice,
  getChannel,
  getLiveStatus,
  getProfileCard,
  postNotice,
  searchChannels,
  type NoticePayload,
  type ProfileCard,
  type SearchResult,
} from '@/client/chzzk/rest';
import type { ChannelDetail } from '@/client/chzzk/types';

export type { ProfileCard, SearchResult };

/** One page of channel search results. */
export function searchChannelPage(query: string, size: number, offset = 0): Promise<SearchResult> {
  return searchChannels(query, { size, offset });
}

export type LiveSummary = { open: boolean; viewers: number } | { failed: true };

/** Live state of several channels at once; a failed lookup is reported, not thrown. */
export async function loadLiveSummaries(channelIds: string[]): Promise<Record<string, LiveSummary>> {
  const results = await Promise.allSettled(channelIds.map((id) => getLiveStatus(id)));
  const out: Record<string, LiveSummary> = {};
  channelIds.forEach((id, i) => {
    const r = results[i];
    out[id] =
      r.status === 'fulfilled' ? { open: r.value.status === 'OPEN', viewers: r.value.concurrentUserCount } : { failed: true };
  });
  return out;
}

/** Channel name/image for headers; null until loaded (or when disabled / failed). */
export function useChannelDetail(channelId: string, enabled = true): ChannelDetail | null {
  const [state, setState] = useState<{ id: string; detail: ChannelDetail } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getChannel(channelId)
      .then((detail) => {
        if (!cancelled) setState({ id: channelId, detail });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [channelId, enabled]);

  return state?.id === channelId ? state.detail : null;
}

/** Profile card for the user opened in the profile sheet; null while loading or with no user. */
export function useProfileCard(
  chatChannelId: string | null,
  userIdHash: string | null,
  cookie?: string,
): ProfileCard | null {
  const key = chatChannelId && userIdHash ? `${chatChannelId}:${userIdHash}` : null;
  const [state, setState] = useState<{ key: string; card: ProfileCard } | null>(null);

  useEffect(() => {
    if (!key || !chatChannelId || !userIdHash) return;
    let cancelled = false;
    // With the cookie, the card includes the viewer-relative follow/subscription details.
    getProfileCard(chatChannelId, userIdHash, cookie)
      .then((card) => {
        if (!cancelled) setState({ key, card });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key, chatChannelId, userIdHash, cookie]);

  return key && state?.key === key ? state.card : null;
}

/** Moderator actions for one chat room; each rejects when the API refuses. */
export interface ModerationTarget {
  chatChannelId: string;
  streamingChannelId: string;
  cookie: string;
}

export function blindChat(t: ModerationTarget, m: { message: string; msgTime: number; userIdHash: string }): Promise<void> {
  return blindMessage(t.chatChannelId, t.cookie, {
    message: m.message,
    messageTime: m.msgTime,
    messageUserIdHash: m.userIdHash,
    streamingChannelId: t.streamingChannelId,
  });
}

export function postChatNotice(t: ModerationTarget, uid: string, text: string): Promise<void> {
  const p: NoticePayload = { message: text, messageTime: Date.now(), messageUserIdHash: uid, streamingChannelId: t.streamingChannelId };
  return postNotice(t.chatChannelId, t.cookie, p);
}

export function clearChatNotice(t: ModerationTarget, uid: string): Promise<void> {
  const p: NoticePayload = { message: '', messageTime: Date.now(), messageUserIdHash: uid, streamingChannelId: t.streamingChannelId };
  return deleteNotice(t.chatChannelId, t.cookie, p);
}
