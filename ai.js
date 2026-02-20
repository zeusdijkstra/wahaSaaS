import Groq from "groq-sdk";

const client = new Groq();

const conversations = new Map();

const SYSTEM_PROMPT =
  process.env.BOT_SYSTEM_PROMPT ||
  "You are a helpful WhatsApp assistant. Keep replies short and friendly, like a real chat.";

const MAX_HISTORY = 20;

/**
 * Get or create conversation history for a chat
 */
function getHistory(chatId) {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, []);
  }
  return conversations.get(chatId);
}

/**
 * Send a message to Claude and get a reply, maintaining conversation history
 * @param {string} chatId      - WhatsApp chat ID (used to track history)
 * @param {string} userMessage - The incoming WhatsApp message text
 * @returns {string}           - Claude's reply
 */
export async function getAIReply(chatId, userMessage) {
  const history = getHistory(chatId);

  // Add the new user message
  history.push({ role: "user", content: userMessage });

  // Trim history if it's getting long (keep last N messages)
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  const response = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ],
  });

  const reply = response.choices[0].message.content;

  // Save assistant reply to history
  history.push({ role: "assistant", content: reply });

  return reply;
}

/**
 * Clear conversation history for a chat (e.g. user says "reset")
 */
export function clearHistory(chatId) {
  conversations.delete(chatId);
}

/**
 * Get how many active conversations are in memory
 */
export function getStats() {
  return {
    activeConversations: conversations.size,
    chats: [...conversations.keys()].map((id) => ({
      chatId: id,
      messages: conversations.get(id).length,
    })),
  };
}
