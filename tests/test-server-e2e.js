import 'dotenv/config';
import express from 'express';
import { createMessageHandler } from '../src/server/messageHandler.js';

const PORT = 3099;
const GF_NUMBER = "621278424236@c.us";

let sendSeenCalls = [];
let sendMessageCalls = [];
let getAIReplyCalls = [];
let sendSeenShouldFail = false;
let mockGetAIReply;

function createHandler() {
  mockGetAIReply = async (chatId, text) => {
    getAIReplyCalls.push({ chatId, text, timestamp: Date.now() });
    return "Test reply";
  };
  
  return createMessageHandler({
    sendSeen: async (chatId) => {
      sendSeenCalls.push({ chatId, timestamp: Date.now() });
      if (sendSeenShouldFail) {
        throw new Error("sendSeen failed");
      }
    },
    sendMessage: async (chatId, text) => {
      sendMessageCalls.push({ chatId, text, timestamp: Date.now() });
    },
    clearHistory: async (chatId) => {},
  }, {
    gfNumber: GF_NUMBER,
  });
}

function resetCalls() {
  sendSeenCalls = [];
  sendMessageCalls = [];
  getAIReplyCalls = [];
}

let handler = createHandler();

const RESET_COMMAND = "/reset";

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const event = req.body;
  if (!event || typeof event !== "object") return;

  const msg = event.payload;
  if (!handler.shouldHandleMessage(event, msg)) return;

  const chatId = msg.chatId;
  const text = msg.body.trim();

  if (text.toLowerCase() === RESET_COMMAND) {
    await handler.handleResetCommand(chatId);
    return;
  }

  await handler.handleIncomingMessage(chatId, text, { getAIReply: mockGetAIReply });
});

app.get("/status", (req, res) => {
  res.json({ status: "running", activeConversations: 0, chats: [] });
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
  let passed = 0;
  let failed = 0;

  console.log('=== Testing /status endpoint ===\n');
  
  const statusRes = await makeRequest('GET', '/status');
  console.log(`GET /status: ${statusRes.status === 200 ? 'PASS' : 'FAIL'} (status: ${statusRes.status})`);
  if (statusRes.status === 200) passed++; else failed++;

  console.log('\n=== Testing /webhook endpoint (basic) ===\n');

  const basicTests = [
    { name: 'Valid message (200)', expected: 200, payload: { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "Hello" } } },
    { name: '/reset command (200)', expected: 200, payload: { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "/reset" } } },
    { name: 'fromMe=true - ignored (200)', expected: 200, payload: { event: "message", payload: { fromMe: true, chatId: GF_NUMBER, body: "Test" } } },
    { name: 'Wrong chatId - ignored (200)', expected: 200, payload: { event: "message", payload: { fromMe: false, chatId: "wrong@c.us", body: "Test" } } },
    { name: 'Empty body - ignored (200)', expected: 200, payload: { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "" } } },
    { name: 'Non-message event (200)', expected: 200, payload: { event: "session", payload: { fromMe: false, chatId: GF_NUMBER, body: "Test" } } },
  ];

  for (const test of basicTests) {
    const res = await makeRequest('POST', '/webhook', test.payload);
    const isPass = res.status === test.expected;
    console.log(`${test.name}: ${isPass ? 'PASS' : 'FAIL'}`);
    if (isPass) passed++; else failed++;
  }

  console.log('\n=== Testing sendSeen integration ===\n');

  resetCalls();
  await makeRequest('POST', '/webhook', { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "Hello" } });
  
  const test1 = sendSeenCalls.length > 0;
  console.log(`${test1 ? 'PASS' : 'FAIL'} sendSeen called on valid message`);
  if (test1) passed++; else failed++;

  const test2 = sendMessageCalls.length > 0;
  console.log(`${test2 ? 'PASS' : 'FAIL'} sendMessage called after sendSeen succeeds`);
  if (test2) passed++; else failed++;

  console.log('\n=== Testing sendSeen failure handling ===\n');

  sendSeenShouldFail = true;
  resetCalls();
  
  await makeRequest('POST', '/webhook', { event: "message", payload: { fromMe: false, chatId: GF_NUMBER, body: "Hello" } });

  const test3 = sendSeenCalls.length > 0;
  console.log(`${test3 ? 'PASS' : 'FAIL'} sendSeen called even when it fails`);
  if (test3) passed++; else failed++;

  const test4 = sendMessageCalls.length === 0;
  console.log(`${test4 ? 'PASS' : 'FAIL'} sendMessage NOT called when sendSeen fails`);
  if (test4) passed++; else failed++;

  const test5 = getAIReplyCalls.length === 0;
  console.log(`${test5 ? 'PASS' : 'FAIL'} getAIReply NOT called when sendSeen fails`);
  if (test5) passed++; else failed++;

  console.log(`\n=== Summary: ${passed}/${passed+failed} passed ===`);
}
