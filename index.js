import "dotenv/config";
import app from "./src/server/index.js";
import { startSession } from "./src/waha/index.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_URL = `http://localhost:${PORT}/webhook`;
const STATUS_URL = `http://localhost:${PORT}/status`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Starts the Express webhook server and logs the available endpoints.
 *
 * @returns {Promise<void>} Resolves once the server is listening.
 */
function startWebhookServer() {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`Webhook server listening on http://localhost:${PORT}`);
      console.log(`  Webhook endpoint : ${WEBHOOK_URL}`);
      console.log(`  Status endpoint  : ${STATUS_URL}`);
      resolve();
    });
  });
}

/**
 * Logs a banner message indicating the bot is ready to receive messages.
 */
function logReadyBanner() {
  console.log("-----------------------------------------------------------");
  console.log("  Bot is live. Waiting for WhatsApp messages...");
  console.log(`  Status: ${STATUS_URL}`);
  console.log("-----------------------------------------------------------");
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function boot() {
  await startSession(WEBHOOK_URL);
  await startWebhookServer();
  logReadyBanner();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

boot().catch((err) => {
  console.error("Failed to start:");
  console.error(`  ${err.message}`);

  if (err.message.includes("ECONNREFUSED")) {
    console.error("Is WAHA running? Start it with:");
    console.error("  docker run -it -p 3000:3000 devlikeapro/waha");
  }

  process.exit(1);
});
