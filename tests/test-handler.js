import 'dotenv/config';
import { createMessageHandler } from '../src/server/messageHandler.js';

const GF_NUMBER = "621278424236@c.us";

const handler = createMessageHandler({
  gfNumber: GF_NUMBER,
});

console.log('Testing shouldHandleMessage directly:\n');

const tests = [
  { name: 'Valid message', event: { event: "message" }, msg: { fromMe: false, chatId: GF_NUMBER, body: "Hello" }, expected: true },
  { name: '/reset command', event: { event: "message" }, msg: { fromMe: false, chatId: GF_NUMBER, body: "/reset" }, expected: true },
  { name: 'fromMe=true', event: { event: "message" }, msg: { fromMe: true, chatId: GF_NUMBER, body: "Test" }, expected: false },
  { name: 'Wrong chatId', event: { event: "message" }, msg: { fromMe: false, chatId: "wrong@c.us", body: "Test" }, expected: false },
  { name: 'Empty body', event: { event: "message" }, msg: { fromMe: false, chatId: GF_NUMBER, body: "" }, expected: false },
  { name: 'Non-message event', event: { event: "session" }, msg: { fromMe: false, chatId: GF_NUMBER, body: "Test" }, expected: false },
];

for (const t of tests) {
  const result = handler.shouldHandleMessage(t.event, t.msg);
  const pass = result === t.expected;
  console.log(`${pass ? '✓' : '✗'} ${t.name}: got ${result}, expected ${t.expected}`);
}
