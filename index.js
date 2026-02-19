import "dotenv/config";
import app from "./server.js";
import { startSession } from "./waha.js";

const PORT = process.env.WEBHOOK_PORT || 3001;

async function boot() {
  console.log("Starting WhatsApp AI Bot...\n");

  // 1. Start our webhook server
  app.listen(PORT, () => {
    console.log(`Webhook server listening on http://localhost:${PORT}`);
  });

  // 2. Start Waha session with webhook config
  console.log("\nConnecting to Waha...");
  const webhookUrl = `http://localhost:${PORT}/webhook`;
  await startSession(webhookUrl);

  console.log("\n🤖 Bot is live! Waiting for WhatsApp messages...");
  console.log("   Stats: http://localhost:" + PORT + "/status");
  console.log("\n   Tip: Send /reset in any WhatsApp chat to clear its history");
  console.log("   Tip: Stop the app to stop the bot\n");
}

boot().catch((err) => {
  console.error("\n❌ Failed to start:", err.message);
  console.error(
    "\n👉 Is Waha running? Start it with:\n   docker run -it -p 3000:3000 devlikeapro/waha\n"
  );
  process.exit(1);
});
