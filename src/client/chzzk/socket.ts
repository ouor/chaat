import {
  type BlindEvent,
  Cmd,
  connectMessage,
  parseBlind,
  parseChatMessages,
  parseConnected,
  parseRecentChat,
  pingMessage,
  pongMessage,
  recentChatMessage,
  sendChatMessage,
} from './protocol';
import type { ChatMessage } from './types';

export type ConnState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface ChatTokens {
  accessToken: string;
  extraToken: string;
}

export interface ChatSocketOptions {
  chatChannelId: string;
  /** The streamer's channel id; outgoing chats must name it (not the chat room id). */
  streamingChannelId: string;
  /** Called on every (re)connect so a reconnect never reuses an expired token. */
  getAccessToken: () => Promise<ChatTokens>;
  uid?: string;
  onMessage: (m: ChatMessage) => void;
  onNotice?: (text: string) => void;
  onBlind?: (e: BlindEvent) => void;
  onConnected?: () => void;
  onStateChange?: (s: ConnState) => void;
}

function socketUrl(chatChannelId: string): string {
  const n = Math.abs([...chatChannelId].reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 9 + 1;
  return `wss://kr-ss${n}.chat.naver.com/chat`;
}

const DEFAULT_TIMING = {
  /** Send an app-level ping after this much silence. */
  pingMs: 20000,
  /** No frame (chat, PONG, anything) for this long means the TCP connection is dead. */
  staleMs: 45000,
  /** How often the liveness watchdog runs. */
  watchdogMs: 10000,
  /** Backoff resets only after a connection stayed up this long (no 1s reconnect storms). */
  stableMs: 30000,
};

export type SocketTiming = typeof DEFAULT_TIMING;

export class ChatSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sid: string | undefined;
  private extraToken = '';
  private state: ConnState = 'idle';
  private retries = 0;
  private closed = false;
  private background = false;
  private resumeOnForeground = false;
  private lastRx = 0;
  /** Last non-PONG frame; the ping goes out after pingMs of this silence. */
  private lastActivity = 0;
  private lastPingAt = 0;
  private reconnectAt = 0;
  /** When the current open started waiting on the token; 0 once a socket exists. */
  private openingSince = 0;
  private connectedAt = 0;
  /** Bumped on every open/drop so a stale async open or a dead socket's late events are ignored. */
  private gen = 0;
  private readonly timing: SocketTiming;

  constructor(
    private readonly opts: ChatSocketOptions,
    timing: Partial<SocketTiming> = {},
  ) {
    this.timing = { ...DEFAULT_TIMING, ...timing };
  }

  connect(): void {
    this.closed = false;
    this.watchdogTimer ??= setInterval(() => this.checkLiveness(), this.timing.watchdogMs);
    void this.openSocket();
  }

  /** Returns false when the chat could not be sent (not connected), so the caller keeps the draft. */
  sendChat(text: string): boolean {
    if (this.state !== 'connected' || this.ws?.readyState !== WebSocket.OPEN) return false;
    const extras = {
      chatType: 'STREAMING',
      emojis: {},
      osType: 'PC',
      extraToken: this.extraToken,
      streamingChannelId: this.opts.streamingChannelId,
    } as const;
    this.send(JSON.stringify(sendChatMessage(this.opts.chatChannelId, text, Date.now(), extras, this.sid)));
    return true;
  }

  requestRecent(count = 50): void {
    if (!this.sid) return;
    this.send(JSON.stringify(recentChatMessage(this.opts.chatChannelId, this.sid, count)));
  }

  /**
   * App foreground/background (wired by the store from AppState; "active" also while the
   * background keeper runs). In the background the connection is dropped: JS timers stop there,
   * so nothing would flush what keeps arriving and it would pile up in memory until the app is
   * killed. On return we reconnect right away (the recent-chat replay refills the gap), and also
   * replace a connection that went silent (doze / network switch leave half-open sockets).
   */
  setForeground(active: boolean): void {
    this.background = !active;
    if (this.closed) return;
    if (!active) {
      this.suspend();
      return;
    }
    // Back in front: skip a pending backoff wait, and replace a connection that went silent.
    if (this.resumeOnForeground || this.reconnectTimer || this.isStale()) {
      this.resumeOnForeground = false;
      this.reconnectNow();
    }
  }

  /**
   * Runs whatever the socket's own timers would have, for an outside clock to call when JS timers
   * don't fire (Android stops them once the app is in the background). Each step checks its own
   * deadline, so calling it while the timers do work changes nothing.
   */
  pump(): void {
    if (this.closed) return;
    const now = Date.now();
    if (this.reconnectTimer && now >= this.reconnectAt) {
      clearTimeout(this.reconnectTimer);
      void this.openSocket();
      return;
    }
    const quietSince = Math.max(this.lastActivity, this.lastPingAt);
    if (this.ws?.readyState === WebSocket.OPEN && this.state === 'connected' && now - quietSince >= this.timing.pingMs) {
      this.sendPing();
    }
    this.checkLiveness();
  }

  close(): void {
    this.closed = true;
    this.gen += 1;
    this.openingSince = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.stopPing();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.setState('offline');
  }

  private setState(s: ConnState): void {
    if (this.state !== s) {
      this.state = s;
      this.opts.onStateChange?.(s);
    }
  }

  private isStale(): boolean {
    return this.state === 'connected' && Date.now() - this.lastRx > this.timing.staleMs;
  }

  private async openSocket(): Promise<void> {
    this.reconnectTimer = null;
    const gen = ++this.gen;
    this.openingSince = Date.now();
    this.setState(this.retries > 0 ? 'reconnecting' : 'connecting');
    let accTkn: string;
    try {
      const tokens = await this.opts.getAccessToken();
      accTkn = tokens.accessToken;
      this.extraToken = tokens.extraToken;
    } catch {
      if (!this.closed && gen === this.gen) {
        this.openingSince = 0;
        this.scheduleReconnect();
      }
      return;
    }
    if (this.closed || gen !== this.gen) return;
    this.openingSince = 0;
    const ws = new WebSocket(socketUrl(this.opts.chatChannelId));
    this.ws = ws;
    this.lastRx = Date.now();
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.send(JSON.stringify(connectMessage(this.opts.chatChannelId, { accTkn, uid: this.opts.uid })));
    };
    ws.onmessage = (e) => {
      if (this.ws === ws) this.onData(e);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.onClose();
    };
    ws.onerror = () => undefined;
  }

  private onData(e: MessageEvent): void {
    if (this.closed) return;
    this.lastRx = Date.now();
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
      this.lastActivity = this.lastRx;
      this.schedulePing();
    }
    const connected = parseConnected(raw);
    if (connected) {
      this.sid = connected.sid;
      this.connectedAt = Date.now();
      this.setState('connected');
      this.opts.onConnected?.();
      this.requestRecent(50);
    }
    if (cmd === Cmd.BLIND) {
      const blind = parseBlind(raw);
      if (blind) this.opts.onBlind?.(blind);
      return;
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
    this.ws = null;
    this.stopPing();
    this.sid = undefined;
    if (this.closed) {
      this.setState('offline');
      return;
    }
    // Only a connection that stayed up resets the backoff; accept-then-drop must still back off.
    if (this.connectedAt && Date.now() - this.connectedAt >= this.timing.stableMs) this.retries = 0;
    this.connectedAt = 0;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    // No longer connected: sendChat must refuse instead of writing into a closed socket.
    this.setState('reconnecting');
    if (this.background) {
      this.resumeOnForeground = true;
      return;
    }
    const base = Math.min(1000 * 2 ** this.retries, 15000);
    const delay = base * (0.75 + Math.random() * 0.5);
    this.retries += 1;
    this.reconnectAt = Date.now() + delay;
    this.reconnectTimer = setTimeout(() => void this.openSocket(), delay);
  }

  /** Drop the current socket without waiting for its close handshake (a dead TCP never answers). */
  private reconnectNow(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.stopPing();
    this.sid = undefined;
    this.connectedAt = 0;
    void this.openSocket();
  }

  /** Drops the connection (or an open in flight) until the next foreground. */
  private suspend(): void {
    this.gen += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.stopPing();
    this.sid = undefined;
    this.connectedAt = 0;
    this.openingSince = 0;
    this.resumeOnForeground = true;
    this.setState('reconnecting');
  }

  private checkLiveness(): void {
    if (this.closed || this.background) return;
    const now = Date.now();
    if (!this.ws) {
      // Stuck before a socket exists (token request that never settles, e.g. its abort timer
      // didn't fire because JS timers were paused): abandon that open and back off as a failure.
      if (this.openingSince && now - this.openingSince > this.timing.staleMs) {
        this.gen += 1;
        this.openingSince = 0;
        this.scheduleReconnect();
      }
      return;
    }
    if (now - this.lastRx > this.timing.staleMs) this.reconnectNow();
  }

  private schedulePing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.sendPing();
    }, this.timing.pingMs);
  }

  private sendPing(): void {
    this.lastPingAt = Date.now();
    this.send(JSON.stringify(pingMessage(this.opts.chatChannelId)));
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
