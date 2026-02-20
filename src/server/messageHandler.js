import { clearHistory as defaultClearHistory } from "../ai/index.js";
import { sendMessage as defaultSendMessage } from "../waha/index.js";

const DEFAULT_CONFIG = {
  gfNumber: process.env.GF_NUMBER || "621278424236@c.us",
  resetCommand: "/reset",
  resetReply: "Conversation reset. How can I help you?",
  privateOnly: process.env.PRIVATE_ONLY !== "false",
  groupChatSuffix: "@g.us",
  sendMessage: defaultSendMessage,
  clearHistory: defaultClearHistory,
};

export function createMessageHandler(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  function shouldHandleMessage(event, msg) {
    if (event.event !== "message") return false;
    if (msg.fromMe) return false;
    if (msg.chatId !== cfg.gfNumber) return false;
    if (cfg.privateOnly && msg.chatId.endsWith(cfg.groupChatSuffix)) return false;
    if (!msg.body || typeof msg.body !== "string") return false;
    return true;
  }

  async function handleResetCommand(chatId) {
    try {
      cfg.clearHistory(chatId);
      await cfg.sendMessage(chatId, cfg.resetReply);
      console.log(`Conversation history cleared for chat: ${chatId}`);
    } catch (err) {
      console.error(`Failed to handle reset command for chat ${chatId}: ${err.message}`);
    }
  }

  async function handleIncomingMessage(chatId, text, { getAIReply }) {
    let reply;

    try {
      reply = await getAIReply(chatId, text);
    } catch (err) {
      console.error(`Failed to get AI reply for chat ${chatId}: ${err.message}`);
      return;
    }

    try {
      await cfg.sendMessage(chatId, reply);
      console.log(`Reply sent to ${chatId}: "${reply}"`);
    } catch (err) {
      console.error(`Failed to send message to chat ${chatId}: ${err.message}`);
    }
  }

  return {
    shouldHandleMessage,
    handleResetCommand,
    handleIncomingMessage,
  };
}

export function getDefaultHandler() {
  return createMessageHandler();
}
