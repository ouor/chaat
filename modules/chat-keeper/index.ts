import { NativeModule, requireOptionalNativeModule } from 'expo';
import { AppRegistry } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';

export interface KeeperMessage {
  nickname: string;
  text: string;
  /** Epoch ms. */
  time: number;
}

type ChatKeeperEvents = {
  onStopped(): void;
  onTick(): void;
};

declare class ChatKeeperNative extends NativeModule<ChatKeeperEvents> {
  start(title: string): void;
  update(title: string, messages: KeeperMessage[]): Promise<void>;
  stop(): void;
}

// Android only; absent on web (and iOS), where background collection simply isn't offered.
const native = requireOptionalNativeModule<ChatKeeperNative>('ChatKeeper');

export const isChatKeeperAvailable = native != null;

// Must match TASK_KEY in ChatKeeperModule.kt. Native starts this headless task with the service so
// RN keeps JS timers running in the background; it stays pending until native finishes it on stop
// (resolving it would report the task done and pause timers again).
const TASK_KEY = 'ChatKeeper';
if (native) AppRegistry.registerHeadlessTask(TASK_KEY, () => () => new Promise<void>(() => {}));

/** Starts the foreground service. Call while the app is in the foreground. */
export function startChatKeeper(title: string): void {
  native?.start(title);
}

/** Replaces the notification's title and newest messages. */
export function updateChatKeeper(title: string, messages: KeeperMessage[]): void {
  void native?.update(title, messages).catch(() => undefined);
}

export function stopChatKeeper(): void {
  native?.stop();
}

/**
 * The service ended without the app stopping it: "그만 받기" on the notification, the task swiped
 * away from recents, or the system. Not fired for stopChatKeeper().
 */
export function onChatKeeperStopped(listener: () => void): EventSubscription | null {
  return native?.addListener('onStopped', listener) ?? null;
}

/**
 * Fires every second while the service runs, from a native thread. JS timers stop once the app is
 * in the background (Choreographer is paused), so background work is driven from this instead.
 */
export function onChatKeeperTick(listener: () => void): EventSubscription | null {
  return native?.addListener('onTick', listener) ?? null;
}
