import axios from "axios";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SESSION = process.env.WAHA_SESSION || "default";

const wahaClient = axios.create({
  baseURL: process.env.WAHA_URL,
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": process.env.WAHA_API_KEY,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a human-readable error message from an Axios error.
 */
function extractErrorMessage(err) {
  if (err.response) {
    const { status, data } = err.response;
    return data?.error?.message ?? data?.message ?? `HTTP ${status}`;
  }
  if (err.request) return "No response from WAHA server";
  return err.message ?? "Unknown error";
}

/**
 * Returns the session config object used when creating a session.
 */
function buildSessionConfig(webhookUrl) {
  const config = {
    debug: process.env.WAHA_DEBUG === "true",
    client: {
      deviceName: process.env.WAHA_CLIENT_DEVICE_NAME || "WAHABot",
    },
    ignore: {
      groups: process.env.WAHA_IGNORE_GROUPS === "true",
      status: process.env.WAHA_IGNORE_STATUS === "true",
      channels: process.env.WAHA_IGNORE_CHANNELS === "true",
      broadcast: process.env.WAHA_IGNORE_BROADCAST === "true",
    },
    webhooks: [
      {
        url: webhookUrl,
        events: ["message", "message.reaction", "session.status"],
      },
    ],
  };

  return config;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a text message to the given WhatsApp chat.
 *
 * @param {string} chatId - The WhatsApp chat ID to send the message to.
 * @param {string} text   - The message body.
 */
export async function sendMessage(chatId, text) {
  if (!chatId) throw new Error("chatId is required");
  if (!text) throw new Error("text is required");

  try {
    await wahaClient.post("/api/sendText", { session: SESSION, chatId, text });
  } catch (err) {
    throw new Error(`Failed to send message: ${extractErrorMessage(err)}`);
  }
}

/**
 * Marks messages in a chat as seen.
 *
 * @param {string} chatId - The WhatsApp chat ID to mark as seen.
 */
export async function sendSeen(chatId) {
  if (!chatId) throw new Error("chatId is required");

  try {
    await wahaClient.post("/api/sendSeen", { session: SESSION, chatId });
  } catch (err) {
    throw new Error(`Failed to send seen: ${extractErrorMessage(err)}`);
  }
}

/**
 * Sends a reaction emoji to a message.
 *
 * @param {string} chatId     - The WhatsApp chat ID.
 * @param {string} messageId  - The message ID to react to.
 * @param {string} reaction   - The emoji reaction.
 */
export async function sendReaction(chatId, messageId, reaction) {
  if (!chatId) throw new Error("chatId is required");
  if (!messageId) throw new Error("messageId is required");

  try {
    await wahaClient.put("/api/reaction", { session: SESSION, chatId, messageId, reaction });
  } catch (err) {
    throw new Error(`Failed to send reaction: ${extractErrorMessage(err)}`);
  }
}

/**
 * Updates the session config in WAHA.
 *
 * @param {string} webhookUrl - The URL WAHA will POST events to.
 */
export async function startSession(webhookUrl) {
  if (!webhookUrl) throw new Error("webhookUrl is required");

  try {
    await wahaClient.put(`/api/sessions/${SESSION}`, {
      name: SESSION,
      config: buildSessionConfig(webhookUrl),
    });
    console.log(`Session "${SESSION}" config updated.`);
  } catch (err) {
    throw new Error(`Failed to update session config: ${extractErrorMessage(err)}`);
  }
}

/**
 * Returns the current session object.
 *
 * @returns {Promise<object>}
 */
export async function getSession() {
  try {
    const res = await wahaClient.get(`/api/sessions/${SESSION}`);
    return res.data;
  } catch (err) {
    throw new Error(`Failed to get session: ${extractErrorMessage(err)}`);
  }
}

/**
 * Lists all sessions. Pass `all = true` to include inactive ones.
 *
 * @param {boolean} all - Whether to include all sessions, not just active ones.
 * @returns {Promise<object[]>}
 */
export async function listSessions(all = false) {
  const url = all ? "/api/sessions?all=true" : "/api/sessions";
  try {
    const res = await wahaClient.get(url);
    return res.data;
  } catch (err) {
    throw new Error(`Failed to list sessions: ${extractErrorMessage(err)}`);
  }
}
