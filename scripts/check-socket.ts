import { ChatSocket } from '../src/client/chzzk/socket';
import { Cmd } from '../src/client/chzzk/protocol';

// Fake WebSocket: records instances so the check can drive open/close/message by hand.
class FakeWs {
  static OPEN = 1;
  static all: FakeWs[] = [];
  readyState = FakeWs.OPEN;
  sent: string[] = [];
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (e: { data: string }) => void;
  onerror?: () => void;
  constructor(public url: string) {
    FakeWs.all.push(this);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    queueMicrotask(() => this.onclose?.());
  }
  drop() {
    this.onclose?.();
  }
  receive(raw: unknown) {
    this.onmessage?.({ data: JSON.stringify(raw) });
  }
}
(globalThis as { WebSocket: unknown }).WebSocket = FakeWs;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const assert = (cond: boolean, label: string) => {
  if (!cond) throw new Error(`socket check failed: ${label}`);
};

async function main() {
  let tokens = 0;
  const sock = new ChatSocket({
    chatChannelId: 'abc',
    getAccessToken: async () => `t${++tokens}`,
    onMessage: () => undefined,
  });

  sock.connect();
  await sleep(0);
  assert(FakeWs.all.length === 1, 'opens one socket');
  FakeWs.all[0].onopen?.();
  assert(FakeWs.all[0].sent[0].includes('"accTkn":"t1"'), 'connect uses first token');

  // Drop -> reconnect after 1s backoff with a fresh token.
  FakeWs.all[0].drop();
  await sleep(1100);
  assert(FakeWs.all.length === 2, 'reconnects after drop');
  FakeWs.all[1].onopen?.();
  assert(FakeWs.all[1].sent[0].includes('"accTkn":"t2"'), 'reconnect refetches token');

  // CONNECTED resets backoff, so the next drop retries after 1s again (not 2s).
  FakeWs.all[1].receive({ cmd: Cmd.CONNECTED, bdy: { sid: 's' } });
  FakeWs.all[1].drop();
  await sleep(1100);
  assert(FakeWs.all.length === 3, 'backoff resets after CONNECTED');

  // close() while a reconnect is pending must not open a new socket.
  FakeWs.all[2].drop();
  sock.close();
  await sleep(1500);
  assert(FakeWs.all.length === 3, 'close cancels pending reconnect');
}

main()
  .then(() => console.log('socket check: ok'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
