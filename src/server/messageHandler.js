import { clearHistory as defaultClearHistory } from "../ai/index.js";
import { sendMessage as defaultSendMessage, sendSeen as defaultSendSeen, sendReaction as defaultSendReaction } from "../waha/index.js";

const DEFAULT_DEPS = {
  sendMessage: defaultSendMessage,
  sendSeen: defaultSendSeen,
  sendReaction: defaultSendReaction,
  clearHistory: defaultClearHistory,
};

const REACTION_RESPONSES = {
  "❤️": "Cacaaaa 💕 Bara seneng banget lihat reaksi Caca!",
  "😂": "Wkwk Caca ketawa, Bara jadi happy too! 😄",
  "👍": "Nice! Thanks Caca! 👍",
  "😍": "Caca ketebak aja nih 😂💖",
};

const DEFAULT_CONFIG = {
  gfNumber: process.env.GF_NUMBER || "621278424236@c.us",
  resetCommand: "/reset",
  resetReply: "Conversation reset. How can I help you?",
  privateOnly: process.env.PRIVATE_ONLY !== "false",
  groupChatSuffix: "@g.us",
  reactionResponses: REACTION_RESPONSES,
};

export function createMessageHandler(deps = {}, config = {}) {
  const dependencies = { ...DEFAULT_DEPS, ...deps };
  const settings = { ...DEFAULT_CONFIG, ...config };

  async function handleSeen(chatId) {
    await dependencies.sendSeen(chatId);
  }

  function shouldHandleMessage(event, msg) {
    if (event.event !== "message") return false;
    if (msg.fromMe) return false;
    if (msg.chatId !== settings.gfNumber) return false;
    if (settings.privateOnly && msg.chatId.endsWith(settings.groupChatSuffix)) return false;
    if (!msg.body || typeof msg.body !== "string") return false;
    return true;
  }

  async function handleIncomingMessage(chatId, text, { getAIReply }) {
    try {
      await handleSeen(chatId);
    } catch (err) {
      console.error(`Cannot reply to ${chatId}: failed to mark seen - ${err.message}`);
      return;
    }

    let reply;

    try {
      reply = await getAIReply(chatId, text);
    } catch (err) {
      console.error(`Failed to get AI reply for chat ${chatId}: ${err.message}`);
      return;
    }

    try {
      await dependencies.sendMessage(chatId, reply);
      console.log(`Reply sent to ${chatId}: "${reply}"`);
    } catch (err) {
      console.error(`Failed to send message to chat ${chatId}: ${err.message}`);
    }
  }

  async function handleResetCommand(chatId) {
    try {
      dependencies.clearHistory(chatId);
      console.log(`Conversation reset for ${chatId}`);
      await dependencies.sendMessage(chatId, settings.resetReply);
    } catch (err) {
      console.error(`Failed to reset conversation for ${chatId}: ${err.message}`);
    }
  }

  async function handleReaction(chatId, reactionText) {
    const response = settings.reactionResponses[reactionText];
    if (!response) return;

    try {
      await dependencies.sendMessage(chatId, response);
      console.log(`Reaction response sent to ${chatId}: "${response}"`);
    } catch (err) {
      console.error(`Cannot send reaction response to ${chatId}: ${err.message}`);
    }
  }

  return {
    shouldHandleMessage,
    handleIncomingMessage,
    handleResetCommand,
    handleSeen,
    handleReaction,
  };
}

export function getDefaultHandler() {
  return createMessageHandler();
}
