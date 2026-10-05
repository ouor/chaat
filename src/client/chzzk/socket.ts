import {
  Cmd,
  connectMessage,
  parseChatMessages,
  parseRecentChat,
  pingMessage,
  pongMessage,
  recentChatMessage,
  sendChatMessage,
} from './protocol';
import type { ChatMessage } from './types';

export type ConnState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface ChatSocketOptions {
  chatChannelId: string;
  /** Called on every (re)connect so a reconnect never reuses an expired token. */
  getAccessToken: () => Promise<string>;
  uid?: string;
  onMessage: (m: ChatMessage) => void;
  onNotice?: (text: string) => void;
  onConnected?: () => void;
  onStateChange?: (s: ConnState) => void;
}

function socketUrl(chatChannelId: string): string {
  const n = Math.abs([...chatChannelId].reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 9 + 1;
  return `wss://kr-ss${n}.chat.naver.com/chat`;
}

export class ChatSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sid: string | undefined;
  private state: ConnState = 'idle';
  private retries = 0;
  private closed = false;

  constructor(private readonly opts: ChatSocketOptions) {}

  connect(): void {
    this.closed = false;
    void this.openSocket();
  }

  sendChat(text: string): void {
    if (this.state !== 'connected') return;
    const now = Date.now();
    const extras = JSON.stringify({
      chatType: 'STREAMING',
      emojis: {},
      osType: 'PC',
      streamingChannelId: this.opts.chatChannelId,
    });
    this.send(JSON.stringify(sendChatMessage(this.opts.chatChannelId, text, now, extras, this.sid)));
  }

  requestRecent(count = 50): void {
    if (!this.sid) return;
    this.send(JSON.stringify(recentChatMessage(this.opts.chatChannelId, this.sid, count)));
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    this.ws?.close();
    this.ws = null;
    this.setState('offline');
  }

  private setState(s: ConnState): void {
    if (this.state !== s) {
      this.state = s;
      this.opts.onStateChange?.(s);
    }
  }

  private async openSocket(): Promise<void> {
    this.reconnectTimer = null;
    this.setState(this.retries > 0 ? 'reconnecting' : 'connecting');
    let accTkn: string;
    try {
      accTkn = await this.opts.getAccessToken();
    } catch {
      if (!this.closed) this.scheduleReconnect();
      return;
    }
    if (this.closed) return;
    const ws = new WebSocket(socketUrl(this.opts.chatChannelId));
    this.ws = ws;
    ws.onopen = () => {
      this.send(JSON.stringify(connectMessage(this.opts.chatChannelId, { accTkn, uid: this.opts.uid })));
    };
    ws.onmessage = (e) => this.onData(e);
    ws.onclose = () => this.onClose();
    ws.onerror = () => undefined;
  }

  private onData(e: MessageEvent): void {
    if (this.closed) return;
    let raw: unknown;
    try {
      raw = JSON.parse(typeof e.data === 'string' ? e.data : String(e.data));
    } catch {
      return;
    }
    if (typeof raw !== 'object' || raw === null) return;
    const cmd = (raw as { cmd?: number }).cmd;

    if (cmd === Cmd.PING) {
      this.ws?.send(JSON.stringify(pongMessage()));
    }
    if (cmd !== Cmd.PONG) {
      this.schedulePing();
    }
    if (cmd === Cmd.CONNECTED) {
      const bdy = (raw as { bdy?: Record<string, unknown> }).bdy;
      if (bdy && typeof bdy.sid === 'string') this.sid = bdy.sid;
      this.retries = 0;
      this.setState('connected');
      this.opts.onConnected?.();
      this.requestRecent(50);
    }
    if (cmd === Cmd.NOTICE) {
      for (const m of parseChatMessages(raw)) {
        if (m.message) this.opts.onNotice?.(m.message);
      }
      return;
    }
    if (cmd === Cmd.CHAT || cmd === Cmd.DONATION) {
      for (const m of parseChatMessages(raw)) this.opts.onMessage(m);
    }
    if (cmd === Cmd.RECENT_CHAT) {
      for (const m of parseRecentChat(raw)) this.opts.onMessage(m);
    }
  }

  private onClose(): void {
    this.stopPing();
    this.sid = undefined;
    if (this.closed) {
      this.setState('offline');
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * 2 ** this.retries, 15000);
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => void this.openSocket(), delay);
  }

  private schedulePing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send(JSON.stringify(pingMessage(this.opts.chatChannelId)));
      }
    }, 20000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private send(payload: string): void {
    this.ws?.send(payload);
  }
}
