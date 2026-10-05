import { WebSocket as NodeWebSocket } from 'ws';

import { getAccessToken, getLiveStatus } from '../src/client/chzzk/rest';
import { ChatSocket } from '../src/client/chzzk/socket';
import type { ChatMessage } from '../src/client/chzzk/types';

(globalThis as { WebSocket: unknown }).WebSocket = NodeWebSocket;

const channelId = process.argv[2];
if (!channelId) {
  console.error('usage: npx tsx scripts/verify-chzzk.ts <channelId>');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const status = await getLiveStatus(channelId);
  console.log(`live-status: status=${status.status} chatChannelId=${status.chatChannelId}`);

  const chatChannelId = status.chatChannelId;
  if (!chatChannelId) {
    console.log('no chat room for this channel');
    return;
  }
  const token = await getAccessToken(chatChannelId);
  console.log(`access-token: realNameAuth=${token.realNameAuth ?? 'n/a'}`);

  let connected = false;
  let count = 0;
  const onMessage = (m: ChatMessage) => {
    count += 1;
    if (count <= 5) console.log(`msg[${m.msgType}] ${m.nickname}: ${m.message}`);
  };
  const sock = new ChatSocket({
    chatChannelId,
    streamingChannelId: channelId,
    getAccessToken: async () => token,
    onMessage,
    onConnected: () => {
      connected = true;
    },
  });
  sock.connect();
  await sleep(8000);
  sock.close();

  console.log(`received=${count} connected=${connected}`);
  if (status.status === 'CLOSE') {
    console.log(
      connected
        ? 'VERDICT 8.1: CLOSE-state chat connection CONFIRMED (WS + CONNECTED succeed after broadcast end)'
        : 'VERDICT 8.1: CLOSE-state chat connection FAILED',
    );
  }
}

main().catch((e) => {
  console.error('verify failed:', e);
  process.exit(1);
});
