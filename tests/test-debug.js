import 'dotenv/config';
import express from 'express';
import { createMessageHandler } from '../src/server/messageHandler.js';

const PORT = 3099;
const GF_NUMBER = "621278424236@c.us";

const handler = createMessageHandler({
  gfNumber: GF_NUMBER,
});

const RESET_COMMAND = "/reset";

let requestCount = 0;

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const reqNum = ++requestCount;
  console.log(`[Req ${reqNum}] Received webhook`);
  
  res.sendStatus(200);

  const event = req.body;
  if (!event || typeof event !== "object") {
    console.log(`[Req ${reqNum}] Malformed payload`);
    return;
  }

  const msg = event.payload;
  const shouldHandle = handler.shouldHandleMessage(event, msg);
  console.log(`[Req ${reqNum}] shouldHandleMessage: ${shouldHandle}, fromMe=${msg.fromMe}, chatId=${msg.chatId}, body="${msg.body}"`);

  if (!shouldHandle) {
    console.log(`[Req ${reqNum}] Message rejected by shouldHandleMessage`);
    return;
  }

  const chatId = msg.chatId;
  const text = msg.body.trim();

  console.log(`[Req ${reqNum}] Handling message: "${text}"`);

  if (text.toLowerCase() === RESET_COMMAND) {
    await handler.handleResetCommand(chatId);
    return;
  }

  await handler.handleIncomingMessage(chatId, text, { getAIReply: async () => "Test reply" });
});

app.get("/status", (req, res) => {
  res.json({ status: "running" });
});

const server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}\n`);
  await runTests();
  server.close();
  process.exit(0);
});

async function makeRequest(method, path, body = null) {
  const http = await import('http');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  const tests = [
    { name: 'Valid message', payload: { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "Hello" } } },
    { name: '/reset command', payload: { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "/reset" } } },
    { name: 'fromMe=true', payload: { event: "message", payload: { fromMe: true, chatId: GF_NUMBER, body: "Test" } } },
    { name: 'Wrong chatId', payload: { event: "message", payload: { fromMe: false, chatId: "wrong@c.us", body: "Test" } } },
    { name: 'Empty body', payload: { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "" } } },
  ];

  for (const test of tests) {
    console.log(`\n--- Test: ${test.name} ---`);
    await makeRequest('POST', '/webhook', test.payload);
  }

  console.log('\n=== Tests Complete ===');
  process.exit(0);
}
