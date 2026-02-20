import 'dotenv/config';
import { getAIReply, clearHistory, getStats } from '../src/ai/index.js';

const testChatId = 'test-chat-123';

console.log('=== Testing ai.js functions ===\n');

console.log('1. Testing getStats() (initial state):');
const initialStats = getStats();
console.log('   Result:', JSON.stringify(initialStats));
console.log('   Status:', initialStats.activeConversations === 0 ? 'PASS' : 'FAIL', '\n');

console.log('2. Testing clearHistory() on non-existent chat:');
clearHistory(testChatId);
const statsAfterClear = getStats();
console.log('   Result:', JSON.stringify(statsAfterClear));
console.log('   Status:', statsAfterClear.activeConversations === 0 ? 'PASS' : 'FAIL', '\n');

console.log('3. Testing getAIReply() - adding a message:');
try {
  const reply = await getAIReply(testChatId, 'Hello, say hi back');
  console.log('   User: Hello, say hi back');
  console.log('   AI Reply:', reply);
  console.log('   Status: PASS\n');
} catch (error) {
  console.log('   Error:', error.message);
  console.log('   Status: FAIL\n');
}

console.log('4. Testing getStats() after adding message:');
const statsAfterMessage = getStats();
console.log('   Result:', JSON.stringify(statsAfterMessage));
console.log('   Status:', statsAfterMessage.activeConversations === 1 ? 'PASS' : 'FAIL', '\n');

console.log('5. Testing clearHistory() to clear conversation:');
clearHistory(testChatId);
const statsAfterClear2 = getStats();
console.log('   Result:', JSON.stringify(statsAfterClear2));
console.log('   Status:', statsAfterClear2.activeConversations === 0 ? 'PASS' : 'FAIL', '\n');

console.log('=== Tests Complete ===');
