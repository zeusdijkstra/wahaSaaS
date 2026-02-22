import express from "express";
import { getAIReply } from "../ai/index.js";
import { getSession } from "../waha/index.js";
import { getDefaultHandler } from "./messageHandler.js";

const RESET_COMMAND = "/reset";
const app = express();
app.use(express.json());

const { shouldHandleMessage, handleIncomingMessage, handleResetCommand, handleReaction } = getDefaultHandler();

app.get("/health", async (req, res) => {
  try {
    const session = await getSession();
    const status = session.status;
    const isWorking = status === "WORKING";

    res.status(isWorking ? 200 : 503).json({
      status: isWorking ? "healthy" : "unhealthy",
      session: session.name,
      waStatus: status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const event = req.body;
  if (!event || typeof event !== "object") {
    console.warn("Received malformed webhook payload.");
    return;
  }

  if (event.event === "session.status") {
    const status = event.payload.status;
    console.log(`Session status changed: ${status}`);
    return;
  }

  if (event.event === "message.reaction") {
    const payload = event.payload;
    if (payload.fromMe === false && 
        payload.from === process.env.GF_NUMBER && 
        payload.reaction?.text) {
      await handleReaction(payload.from, payload.reaction.text);
    }
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
