import { ChatSocket, type SocketTiming } from '../src/client/chzzk/socket';
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
const CONNECTED = { cmd: Cmd.CONNECTED, bdy: { sid: 's' } };

function makeSocket(timing: Partial<SocketTiming> = {}) {
  let tokens = 0;
  const states: string[] = [];
  const sock = new ChatSocket(
    {
      chatChannelId: 'abc',
      streamingChannelId: 'ch1',
      getAccessToken: async () => ({ accessToken: `t${++tokens}`, extraToken: `x${tokens}` }),
      onMessage: () => undefined,
      onStateChange: (st) => states.push(st),
    },
    timing,
  );
  return { sock, states, last: () => FakeWs.all[FakeWs.all.length - 1], count: () => FakeWs.all.length };
}

async function reconnectAndBackoff() {
  FakeWs.all = [];
  const { sock, states, last, count } = makeSocket({ stableMs: 60000 });
  sock.connect();
  await sleep(0);
  assert(count() === 1, 'opens one socket');
  last().onopen?.();
  assert(last().sent[0].includes('"accTkn":"t1"'), 'connect uses first token');
  last().receive(CONNECTED);

  // Drop -> immediately not 'connected' (send refused, draft kept), reconnect after ~1s with a fresh token.
  last().drop();
  assert(states[states.length - 1] === 'reconnecting', 'state leaves connected on close');
  assert(sock.sendChat('hi') === false, 'send refused while reconnecting');
  await sleep(1400);
  assert(count() === 2, 'reconnects after drop');
  last().onopen?.();
  assert(last().sent[0].includes('"accTkn":"t2"'), 'reconnect refetches token');

  // Outgoing chat carries the extraToken from the current connect and the streamer channel id.
  last().receive(CONNECTED);
  assert(sock.sendChat('hi') === true, 'send accepted when connected');
  const sent = JSON.parse(last().sent[last().sent.length - 1]) as { bdy: { extras: string } };
  const extras = JSON.parse(sent.bdy.extras) as Record<string, unknown>;
  assert(extras.extraToken === 'x2' && extras.streamingChannelId === 'ch1', 'send carries extraToken + channel id');

  // Accepted then dropped at once (not stable): backoff keeps growing, no 1s reconnect storm.
  last().drop();
  await sleep(1300);
  assert(count() === 2, 'unstable connection keeps backing off');
  await sleep(1400);
  assert(count() === 3, 'reconnects after longer backoff');

  // close() while a reconnect is pending must not open a new socket.
  last().drop();
  sock.close();
  await sleep(3000);
  assert(count() === 3, 'close cancels pending reconnect');
}

async function watchdog() {
  FakeWs.all = [];
  const { sock, count, last } = makeSocket({ staleMs: 200, watchdogMs: 50 });
  sock.connect();
  await sleep(0);
  last().onopen?.();
  last().receive(CONNECTED);
  // Half-open socket: no frames and no close event. The watchdog must replace it.
  await sleep(400);
  assert(count() >= 2, 'watchdog replaces a silent socket');
  sock.close();
}

async function background() {
  FakeWs.all = [];
  const { sock, count, last } = makeSocket();
  sock.connect();
  await sleep(0);
  last().onopen?.();
  last().receive(CONNECTED);
  sock.setForeground(false);
  last().drop();
  await sleep(1500);
  assert(count() === 1, 'no reconnect loop in background');
  sock.setForeground(true);
  await sleep(0);
  assert(count() === 2, 'reconnects right away on foreground');
  sock.close();
}

async function main() {
  await reconnectAndBackoff();
  await watchdog();
  await background();
}

main()
  .then(() => console.log('socket check: ok'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
