import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { EventSubscription } from 'expo-modules-core';

export interface KeeperMessage {
  nickname: string;
  text: string;
  /** Epoch ms. */
  time: number;
}

type ChatKeeperEvents = {
  onStopRequested(): void;
};

declare class ChatKeeperNative extends NativeModule<ChatKeeperEvents> {
  start(title: string): void;
  update(title: string, messages: KeeperMessage[]): void;
  stop(): void;
}

// Android only; absent on web (and iOS), where background collection simply isn't offered.
const native = requireOptionalNativeModule<ChatKeeperNative>('ChatKeeper');

export const isChatKeeperAvailable = native != null;

/** Starts the foreground service. Call while the app is in the foreground. */
export function startChatKeeper(title: string): void {
  native?.start(title);
}

/** Replaces the notification's title and newest messages. */
export function updateChatKeeper(title: string, messages: KeeperMessage[]): void {
  native?.update(title, messages);
}

export function stopChatKeeper(): void {
  native?.stop();
}

/** The user tapped "그만 받기" on the notification; the service has already stopped. */
export function onChatKeeperStopRequested(listener: () => void): EventSubscription | null {
  return native?.addListener('onStopRequested', listener) ?? null;
}
