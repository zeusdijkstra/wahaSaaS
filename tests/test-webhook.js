import 'dotenv/config';
import express from 'express';
import { createMessageHandler } from '../src/server/messageHandler.js';

// ============================================================
// INFRASTRUCTURE — server setup, mocks, helpers
// ============================================================

const PORT = 3098;
const GF_NUMBER = "621278424236@c.us";

let sendSeenCalls = [];
let sendMessageCalls = [];
let sendReactionCalls = [];
let clearHistoryCalls = [];

function resetCalls() {
  sendSeenCalls = [];
  sendMessageCalls = [];
  sendReactionCalls = [];
  clearHistoryCalls = [];
}

function getCalls() {
  return { sendSeenCalls, sendMessageCalls, sendReactionCalls, clearHistoryCalls };
}

const mockGetAIReply = async (chatId, text) => "Mock AI reply";

const deps = {
  sendSeen: async (chatId) => sendSeenCalls.push({ chatId, timestamp: Date.now() }),
  sendMessage: async (chatId, text) => sendMessageCalls.push({ chatId, text, timestamp: Date.now() }),
  sendReaction: async (chatId, reaction) => sendReactionCalls.push({ chatId, reaction }),
  clearHistory: (chatId) => clearHistoryCalls.push({ chatId, timestamp: Date.now() }),
};

const config = {
  gfNumber: GF_NUMBER,
  privateOnly: true,
  groupChatSuffix: "@g.us",
};

const handler = createMessageHandler(deps, config);

// --- Express app ---

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const event = req.body;

  if (!event || typeof event !== "object") {
    console.warn("Received malformed webhook payload.");
    return;
  }

  if (event.event === "session.status") {
    console.log(`Session status changed: ${event.payload?.status}`);
    return;
  }

  if (event.event === "message.reaction") {
    const payload = event.payload;
    if (payload.fromMe === false && payload.from === GF_NUMBER && payload.reaction?.text) {
      await handler.handleReaction(payload.from, payload.reaction.text);
    }
    return;
  }

  const msg = event.payload;
  if (!handler.shouldHandleMessage(event, msg)) return;

  const chatId = msg.chatId;
  const text = msg.body?.trim() || "";

  if (text.toLowerCase() === "/reset") {
    await handler.handleResetCommand(chatId);
    return;
  }

  await handler.handleIncomingMessage(chatId, text, { getAIReply: mockGetAIReply });
});

// --- Request helper ---

async function makeRequest(body) {
  const http = await import('http');
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: PORT, path: '/webhook', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// --- Event builder helper ---

let msgIdCounter = 1;
function makeMessageEvent({ chatId = GF_NUMBER, body, fromMe = false, timestamp } = {}) {
  return {
    event: "message",
    session: "default",
    payload: {
      id: `test_msg_${msgIdCounter++}`,
      fromMe,
      chatId,
      body,
      timestamp: timestamp ?? Date.now(),
    },
  };
}

function makeReactionEvent({ from = GF_NUMBER, fromMe = false, reactionText } = {}) {
  return {
    event: "message.reaction",
    session: "default",
    payload: {
      fromMe,
      from,
      reaction: { text: reactionText },
    },
  };
}

function makeSessionStatusEvent(status = "WORKING") {
  return { event: "session.status", session: "default", payload: { status } };
}

// ============================================================
// TEST CASES — add new tests here
// ============================================================

const tests = [
  {
    name: "Valid text message → sendSeen + sendMessage called",
    payload: makeMessageEvent({ body: "Hello AI" }),
    assert: ({ sendSeenCalls, sendMessageCalls }) => {
      if (sendSeenCalls.length !== 1) return { pass: false, reason: `Expected 1 sendSeen call, got ${sendSeenCalls.length}` };
      if (sendMessageCalls.length !== 1) return { pass: false, reason: `Expected 1 sendMessage call, got ${sendMessageCalls.length}` };
      return { pass: true, info: `Response: "${sendMessageCalls[0]?.text}"` };
    },
  },
  {
    name: "/reset command → clearHistory + resetReply sent",
    payload: makeMessageEvent({ body: "/reset" }),
    assert: ({ clearHistoryCalls, sendMessageCalls }) => {
      if (clearHistoryCalls.length !== 1) return { pass: false, reason: `Expected 1 clearHistory call, got ${clearHistoryCalls.length}` };
      if (sendMessageCalls.length !== 1) return { pass: false, reason: `Expected 1 sendMessage call, got ${sendMessageCalls.length}` };
      return { pass: true, info: `Response: "${sendMessageCalls[0]?.text}"` };
    },
  },
  {
    name: "Reaction event → reaction response sent",
    payload: makeReactionEvent({ reactionText: "❤️" }),
    assert: ({ sendMessageCalls }) => {
      if (sendMessageCalls.length !== 1) return { pass: false, reason: `Expected 1 sendMessage call, got ${sendMessageCalls.length}` };
      return { pass: true, info: `Response: "${sendMessageCalls[0]?.text}"` };
    },
  },
  {
    name: "fromMe=true → message ignored",
    payload: makeMessageEvent({ body: "My own message", fromMe: true }),
    assert: ({ sendSeenCalls, sendMessageCalls }) => {
      if (sendSeenCalls.length !== 0) return { pass: false, reason: `Expected no sendSeen calls, got ${sendSeenCalls.length}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Wrong chatId → message ignored",
    payload: makeMessageEvent({ body: "Hello from stranger", chatId: "999999999999@c.us" }),
    assert: ({ sendSeenCalls, sendMessageCalls }) => {
      if (sendSeenCalls.length !== 0) return { pass: false, reason: `Expected no sendSeen calls, got ${sendSeenCalls.length}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Empty body → message ignored",
    payload: makeMessageEvent({ body: "" }),
    assert: ({ sendSeenCalls, sendMessageCalls }) => {
      if (sendSeenCalls.length !== 0) return { pass: false, reason: `Expected no sendSeen calls, got ${sendSeenCalls.length}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Missing body → message ignored",
    payload: makeMessageEvent({ body: undefined }),
    assert: ({ sendSeenCalls, sendMessageCalls }) => {
      if (sendSeenCalls.length !== 0) return { pass: false, reason: `Expected no sendSeen calls, got ${sendSeenCalls.length}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Group chat with privateOnly=true → message ignored",
    payload: makeMessageEvent({ body: "Hello from group", chatId: "1234567890@g.us" }),
    assert: ({ sendSeenCalls, sendMessageCalls }) => {
      if (sendSeenCalls.length !== 0) return { pass: false, reason: `Expected no sendSeen calls, got ${sendSeenCalls.length}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "session.status event → returns 200, no action",
    payload: makeSessionStatusEvent("WORKING"),
    assert: ({ sendMessageCalls }, { status }) => {
      if (status !== 200) return { pass: false, reason: `Expected status 200, got ${status}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Null event field → returns 200, no action",
    payload: { event: null, payload: { body: "test" } },
    assert: ({ sendMessageCalls }, { status }) => {
      if (status !== 200) return { pass: false, reason: `Expected status 200, got ${status}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Unknown event type → returns 200, no action",
    payload: { event: "unknown.event", payload: { body: "test" } },
    assert: ({ sendMessageCalls }, { status }) => {
      if (status !== 200) return { pass: false, reason: `Expected status 200, got ${status}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Missing event field → returns 200, no action",
    payload: { payload: { body: "test" } },
    assert: ({ sendMessageCalls }, { status }) => {
      if (status !== 200) return { pass: false, reason: `Expected status 200, got ${status}` };
      if (sendMessageCalls.length !== 0) return { pass: false, reason: `Expected no sendMessage calls, got ${sendMessageCalls.length}` };
      return { pass: true };
    },
  },
  {
    name: "Empty object body → returns 200",
    payload: {},
    assert: (_, { status }) => {
      if (status !== 200) return { pass: false, reason: `Expected status 200, got ${status}` };
      return { pass: true };
    },
  },
];

// ============================================================
// TEST RUNNER — don't touch this unless changing infrastructure
// ============================================================

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const [i, test] of tests.entries()) {
    resetCalls();
    const response = await makeRequest(test.payload);
    // small delay to let async handlers finish
    await new Promise(r => setTimeout(r, 50));

    const result = test.assert(getCalls(), { status: response.status });
    const { pass, reason, info } = result;

    const label = `Test ${i + 1}: ${test.name}`;
    if (pass) {
      console.log(`  ✅ PASS — ${label}${info ? `\n       ${info}` : ''}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL — ${label}\n       Reason: ${reason}`);
      failed++;
    }
  }

  console.log(`\n=== Summary: ${passed}/${passed + failed} passed ===`);
  return { passed, failed };
}

const server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}\n`);
  await runTests();
  server.close();
  process.exit(0);
});
