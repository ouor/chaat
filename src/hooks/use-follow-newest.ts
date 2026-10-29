import { useEffect, useRef, useState } from 'react';
import type { FlatList } from 'react-native';

import { chatKey } from '@/client/chzzk/protocol';
import type { ChatMessage } from '@/client/chzzk/types';

/**
 * Keeps an inverted chat list on the newest message until the user scrolls away, and counts what
 * arrived meanwhile. Spread `listProps` on the FlatList (newest first, so the newest end is offset 0).
 */
export function useFollowNewest(data: ChatMessage[], setReading: (reading: boolean) => void) {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const atBottom = useRef(true);
  // Mirrors atBottom for rendering: maintainVisibleContentPosition is on only while reading.
  // Following the newest end needs nothing (new rows land at offset 0 of the inverted list); with
  // it on, a busy room's batches shifted the offset and its animated autoscroll fired momentum
  // events with no finger on the screen (logged on device), which read as "scrolled up".
  const [following, setFollowing] = useState(true);
  // Only a finger may leave or rejoin the newest end: a drag, or a fling right after one.
  const userScrolling = useRef(false);
  const flingUntil = useRef(0);
  const lastNewest = useRef<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Count arrivals by how far the previous newest message moved, not by list length:
  // once the store caps the list at MAX_MESSAGES the length stops changing. Matched by key, not
  // identity: a blinded row is replaced by a new object and would read as "everything is new".
  useEffect(() => {
    const prev = lastNewest.current;
    lastNewest.current = data[0] ? chatKey(data[0]) : null;
    if (!prev || atBottom.current) return;
    const idx = data.findIndex((m) => chatKey(m) === prev);
    const delta = idx === -1 ? data.length : idx;
    if (delta > 0) setUnread((u) => u + delta);
  }, [data]);

  function onScroll(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const y = e.nativeEvent.contentOffset.y;
    if (!userScrolling.current) {
      // Following the newest chat but the content drifted under a burst: pin it back.
      if (atBottom.current && y > 1) listRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    const bottom = y < 20;
    if (bottom !== atBottom.current) {
      atBottom.current = bottom;
      setFollowing(bottom);
      setReading(!bottom);
      if (bottom) setUnread(0);
    }
  }

  function jumpBottom() {
    atBottom.current = true;
    setFollowing(true);
    setReading(false);
    setUnread(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  const listProps = {
    ref: listRef,
    onScroll,
    onScrollBeginDrag: () => {
      userScrolling.current = true;
    },
    onScrollEndDrag: () => {
      userScrolling.current = false;
      flingUntil.current = Date.now() + 150;
    },
    // A fling starts right as the finger lifts; any other momentum is programmatic.
    onMomentumScrollBegin: () => {
      if (Date.now() < flingUntil.current) userScrolling.current = true;
    },
    onMomentumScrollEnd: () => {
      userScrolling.current = false;
      flingUntil.current = 0;
    },
    scrollEventThrottle: 16,
    // Scrolled up: keep the row being read in place as new chats land at index 0.
    // Following: off, so new chats simply appear at the bottom (offset 0).
    maintainVisibleContentPosition: following ? undefined : { minIndexForVisible: 0 },
  };

  return { listProps, unread, jumpBottom };
}
