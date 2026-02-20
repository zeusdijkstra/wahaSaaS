import express from "express";
import { getAIReply, getStats } from "../ai/index.js";
import { getDefaultHandler } from "./messageHandler.js";

const RESET_COMMAND = "/reset";
const app = express();
app.use(express.json());

const { shouldHandleMessage, handleResetCommand, handleIncomingMessage } = getDefaultHandler();

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

app.get("/status", (_req, res) => {
  try {
    const stats = getStats();
    res.json({ status: "running", ...stats });
  } catch (err) {
    console.error(`Failed to retrieve stats: ${err.message}`);
    res.status(500).json({ status: "error", message: "Could not retrieve stats." });
  }
});

export default app;
