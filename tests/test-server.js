import 'dotenv/config';
import { createMessageHandler } from '../src/server/messageHandler.js';

console.log('=== Testing messageHandler.js ===\n');

const GF_NUMBER = "621278424236@c.us";

let mockSendMessageCalled = false;
let mockSendMessageParams = null;
let mockClearHistoryCalled = false;
let mockClearHistoryChatId = null;
let mockGetAIReplyResult = "Mock AI reply";

const mockSendMessage = async (chatId, text) => {
  mockSendMessageCalled = true;
  mockSendMessageParams = { chatId, text };
};

const mockClearHistory = (chatId) => {
  mockClearHistoryCalled = true;
  mockClearHistoryChatId = chatId;
};

const mockGetAIReply = async (chatId, text) => {
  return mockGetAIReplyResult;
};

const handler = createMessageHandler({
  gfNumber: GF_NUMBER,
  sendMessage: mockSendMessage,
  clearHistory: mockClearHistory,
});

console.log('=== Testing shouldHandleMessage() ===\n');

const testCases = [
  {
    name: '1. Valid private message',
    event: { event: "message" },
    msg: { fromMe: false, chatId: GF_NUMBER, body: "Hello" },
    expected: true
  },
  {
    name: '2. Non-message event',
    event: { event: "session" },
    msg: { fromMe: false, chatId: GF_NUMBER, body: "Hello" },
    expected: false
  },
  {
    name: '3. fromMe is true',
    event: { event: "message" },
    msg: { fromMe: true, chatId: GF_NUMBER, body: "Hello" },
    expected: false
  },
  {
    name: '4. Wrong chatId (not GF_NUMBER)',
    event: { event: "message" },
    msg: { fromMe: false, chatId: "other@c.us", body: "Hello" },
    expected: false
  },
  {
    name: '5. Group chat when privateOnly=true',
    event: { event: "message" },
    msg: { fromMe: false, chatId: "group123@g.us", body: "Hello" },
    expected: false
  },
  {
    name: '6. Empty body',
    event: { event: "message" },
    msg: { fromMe: false, chatId: GF_NUMBER, body: "" },
    expected: false
  },
  {
    name: '7. Non-string body',
    event: { event: "message" },
    msg: { fromMe: false, chatId: GF_NUMBER, body: 123 },
    expected: false
  },
  {
    name: '8. Missing body',
    event: { event: "message" },
    msg: { fromMe: false, chatId: GF_NUMBER },
    expected: false
  },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = handler.shouldHandleMessage(tc.event, tc.msg);
  const status = result === tc.expected ? 'PASS' : 'FAIL';
  console.log(`${tc.name}: ${status} (expected: ${tc.expected}, got: ${result})`);
  if (status === 'PASS') passed++; else failed++;
}

console.log(`\n=== Testing handleResetCommand() ===\n`);

console.log('1. Testing handleResetCommand with valid chatId:');
mockSendMessageCalled = false;
mockSendMessageParams = null;
mockClearHistoryCalled = false;
mockClearHistoryChatId = null;

const testChatId = 'test-chat-456@c.us';
await handler.handleResetCommand(testChatId);

console.log('   clearHistory called:', mockClearHistoryCalled);
console.log('   clearHistory chatId:', mockClearHistoryChatId);
console.log('   sendMessage called:', mockSendMessageCalled);
console.log('   sendMessage params:', JSON.stringify(mockSendMessageParams));

if (mockClearHistoryCalled && mockClearHistoryChatId === testChatId &&
  mockSendMessageCalled && mockSendMessageParams.chatId === testChatId &&
  mockSendMessageParams.text === "Conversation reset. How can I help you?") {
  console.log('   Status: PASS\n');
  passed++;
} else {
  console.log('   Status: FAIL\n');
  failed++;
}

console.log('=== Testing handleIncomingMessage() ===\n');

console.log('1. Testing handleIncomingMessage with valid input:');
mockSendMessageCalled = false;
mockSendMessageParams = null;

const userMessage = "Hello there!";
await handler.handleIncomingMessage(testChatId, userMessage, { getAIReply: mockGetAIReply });

console.log('   getAIReply called, reply:', mockGetAIReplyResult);
console.log('   sendMessage called:', mockSendMessageCalled);
console.log('   sendMessage params:', JSON.stringify(mockSendMessageParams));

if (mockSendMessageCalled && mockSendMessageParams.chatId === testChatId &&
  mockSendMessageParams.text === mockGetAIReplyResult) {
  console.log('   Status: PASS\n');
  passed++;
} else {
  console.log('   Status: FAIL\n');
  failed++;
}

console.log('=== Summary ===');
console.log(`Passed: ${passed}, Failed: ${failed}`);
console.log('=== Tests Complete ===');
