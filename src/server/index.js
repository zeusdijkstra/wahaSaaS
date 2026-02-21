import express from "express";
import { getAIReply } from "../ai/index.js";
import { getDefaultHandler } from "./messageHandler.js";

const RESET_COMMAND = "/reset";
const app = express();
app.use(express.json());

const { shouldHandleMessage, handleIncomingMessage, handleResetCommand } = getDefaultHandler();

// 1. we should do send seen using /api/sendSeen from WAHA
// 2. then, use /api/sendText to send the getAIReply responses

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
  await handleIncomingMessage(chatId, text, { getAIReply });
});

export default app;
