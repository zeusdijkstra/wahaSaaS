import express from "express";
import { sendMessage } from "./waha.js";
import { getAIReply, clearHistory, getStats } from "./ai.js";

const app = express();
app.use(express.json());

const PRIVATE_ONLY = process.env.PRIVATE_ONLY !== "false"; // default true

// ── Incoming message webhook ───────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  // Always respond 200 fast so Waha doesn't retry
  res.sendStatus(200);

  try {
    const event = req.body;

    // We only care about incoming text messages
    if (event.event !== "message") return;

    const msg = event.payload;

    // Skip messages sent by us (the bot)
    if (msg.fromMe) return;

    // Skip group messages if PRIVATE_ONLY is enabled
    if (PRIVATE_ONLY && msg.chatId.endsWith("@g.us")) return;

    // Skip non-text messages (images, voice notes, etc.)
    if (!msg.body || typeof msg.body !== "string") return;

    const chatId = msg.chatId;
    const text = msg.body.trim();

    console.log(`📩 [${chatId}] "${text}"`);

    // Special command: reset conversation history
    if (text.toLowerCase() === "/reset") {
      clearHistory(chatId);
      await sendMessage(chatId, "🔄 Conversation reset! How can I help you?");
      return;
    }

    // Get AI reply
    const reply = await getAIReply(chatId, text);
    console.log(`🤖 [${chatId}] "${reply}"`);

    // Send it back on WhatsApp
    await sendMessage(chatId, reply);
  } catch (err) {
    console.error("❌ Error handling message:", err.message);
  }
});

// ── Health check & stats ───────────────────────────────────────────────────
app.get("/status", (req, res) => {
  res.json({
    status: "running",
    ...getStats(),
  });
});

export default app;
