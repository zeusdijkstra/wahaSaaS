import axios from "axios";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SESSION = process.env.WAHA_SESSION || "default";
const POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_RETRIES = 60;

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
        events: ["message", "session.status"],
      },
    ],
  };

  // if (process.env.WAHA_PROXY_SERVER) {
  //   config.proxy = {
  //     server: process.env.WAHA_PROXY_SERVER,
  //     username: process.env.WAHA_PROXY_USERNAME,
  //     password: process.env.WAHA_PROXY_PASSWORD,
  //   };
  // }

  return config;
}

/**
 * Sleeps for the given number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Internal session polling
// ---------------------------------------------------------------------------

/**
 * Fetches the current session object from the WAHA API.
 */
async function fetchSessionStatus() {
  try {
    const res = await wahaClient.get(`/api/sessions/${SESSION}`);
    return res.data;
  } catch (err) {
    throw new Error(`Failed to get session status: ${extractErrorMessage(err)}`);
  }
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
