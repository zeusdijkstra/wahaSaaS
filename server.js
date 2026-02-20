import express from "express";
import { sendMessage } from "./waha.js";
import { getAIReply, clearHistory, getStats } from "./ai.js";

const PRIVATE_ONLY = process.env.PRIVATE_ONLY !== "false";
const GF_NUMBER = "621278424236@c.us";
const RESET_COMMAND = "/reset";
const RESET_REPLY = "Conversation reset. How can I help you?";
const GROUP_CHAT_SUFFIX = "@g.us";

const app = express();
app.use(express.json());

function shouldHandleMessage(event, msg) {
  if (event.event !== "message") return false;
  if (msg.fromMe) return false;
  if (msg.chatId !== GF_NUMBER) return false;
  if (PRIVATE_ONLY && msg.chatId.endsWith(GROUP_CHAT_SUFFIX)) return false;
  if (!msg.body || typeof msg.body !== "string") return false;
  return true;
}

async function handleResetCommand(chatId) {
  try {
    clearHistory(chatId);
    await sendMessage(chatId, RESET_REPLY);
    console.log(`Conversation history cleared for chat: ${chatId}`);
  } catch (err) {
    console.error(`Failed to handle reset command for chat ${chatId}: ${err.message}`);
  }
}

async function handleIncomingMessage(chatId, text) {
  let reply;

  try {
    reply = await getAIReply(chatId, text);
  } catch (err) {
    console.error(`Failed to get AI reply for chat ${chatId}: ${err.message}`);
    return;
  }

  try {
    await sendMessage(chatId, reply);
    console.log(`Reply sent to ${chatId}: "${reply}"`);
  } catch (err) {
    console.error(`Failed to send message to chat ${chatId}: ${err.message}`);
  }
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const event = req.body;

  if (!event || typeof event !== "object") {
    console.warn("Received malformed webhook payload.");
    return;
  }

  const msg = event.payload;

  if (!shouldHandleMessage(event, msg)) return;

  const chatId = msg.chatId;
  const text = msg.body.trim();

  console.log(`Incoming message from ${chatId}: "${text}"`);

  if (text.toLowerCase() === RESET_COMMAND) {
    await handleResetCommand(chatId);
    return;
  }

  await handleIncomingMessage(chatId, text);
});

app.get("/status", (req, res) => {
  try {
    const stats = getStats();
    res.json({ status: "running", ...stats });
  } catch (err) {
    console.error(`Failed to retrieve stats: ${err.message}`);
    res.status(500).json({ status: "error", message: "Could not retrieve stats." });
  }
});

export default app;
