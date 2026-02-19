import "dotenv/config";
import app from "./server.js";
import { startSession, stopSession, listSessions } from "./waha.js";

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
 * Looks up an existing WAHA session by name.
 * Returns the session object if found, or null if not found or on error.
 *
 * @returns {Promise<object|null>}
 */
async function findExistingSession() {
  try {
    const sessions = await listSessions(true);
    return sessions.find((s) => s.name === process.env.WAHA_SESSION) ?? null;
  } catch {
    return null;
  }
}

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
  await startWebhookServer();

  const existing = await findExistingSession();

  if (existing?.status === "WORKING") {
    const name = existing.me?.pushName ?? "Unknown";
    const id = existing.me?.id ?? "N/A";
    console.log(`Session already running: ${name} (${id})`);
    logReadyBanner();
    return;
  }

  console.log("Connecting to WAHA...");
  await startSession(WEBHOOK_URL);
  logReadyBanner();
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  try {
    await stopSession();
  } catch (err) {
    console.error(`Error stopping session: ${err.message}`);
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

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
