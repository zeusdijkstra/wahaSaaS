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

  if (process.env.WAHA_PROXY_SERVER) {
    config.proxy = {
      server: process.env.WAHA_PROXY_SERVER,
      username: process.env.WAHA_PROXY_USERNAME,
      password: process.env.WAHA_PROXY_PASSWORD,
    };
  }

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

/**
 * Logs the QR code (base64 prefix) so the user knows where to look.
 * Errors are swallowed because QR availability is timing-dependent.
 */
async function logQRCode() {
  try {
    const qr = await getQRCode();
    if (qr.data) {
      console.log("QR Code (base64 preview):", qr.data.substring(0, 100) + "...");
    }
  } catch {
    console.log("QR code not available yet.");
  }
}

/**
 * Polls the session status until it reaches `targetStatus`, throwing if the
 * session fails or the retry limit is exceeded.
 *
 * @param {string} targetStatus - The status to wait for (e.g. "WORKING").
 * @param {number} maxRetries   - Maximum number of polling attempts.
 * @returns {Promise<object>}   - The session object once the target status is reached.
 */
async function waitForSessionStatus(targetStatus, maxRetries = DEFAULT_MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await fetchSessionStatus();
    const { status } = session;

    if (status === targetStatus) return session;

    if (status === "FAILED") {
      throw new Error("Session failed. Try restarting or logging out.");
    }

    if (status === "SCAN_QR_CODE") {
      console.log("Please scan the QR code with your WhatsApp app.");
      await logQRCode();
    }

    console.log(`Session status: ${status} (attempt ${attempt}/${maxRetries})`);
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out after ${maxRetries} attempts waiting for status "${targetStatus}".`);
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
 * Creates (or reuses) a WAHA session and waits until it reaches WORKING status.
 *
 * @param {string} webhookUrl - The URL WAHA will POST events to.
 * @returns {Promise<object>} - The session object once connected.
 */
export async function startSession(webhookUrl) {
  if (!webhookUrl) throw new Error("webhookUrl is required");

  try {
    await wahaClient.post("/api/sessions", {
      name: SESSION,
      config: buildSessionConfig(webhookUrl),
    });
    console.log(`Session "${SESSION}" created.`);
  } catch (err) {
    if (err.response?.status === 422) {
      console.log(`Session "${SESSION}" already exists, reusing it.`);
    } else {
      throw new Error(`Failed to create session: ${extractErrorMessage(err)}`);
    }
  }

  console.log("Waiting for session to reach WORKING status...");

  const session = await waitForSessionStatus("WORKING");

  if (session.me) {
    console.log(`WhatsApp connected: ${session.me.pushName} (${session.me.id})`);
  }

  return session;
}

/**
 * Stops the current session.
 */
export async function stopSession() {
  try {
    await wahaClient.post(`/api/sessions/${SESSION}/stop`);
    console.log(`Session "${SESSION}" stopped.`);
  } catch (err) {
    if (err.response?.status === 404) {
      console.log(`Session "${SESSION}" not found.`);
      return;
    }
    throw new Error(`Failed to stop session: ${extractErrorMessage(err)}`);
  }
}

/**
 * Restarts the current session and waits until it is WORKING again.
 *
 * @returns {Promise<object>} - The session object once reconnected.
 */
export async function restartSession() {
  try {
    await wahaClient.post(`/api/sessions/${SESSION}/restart`);
    console.log(`Session "${SESSION}" is restarting...`);
    return await waitForSessionStatus("WORKING");
  } catch (err) {
    throw new Error(`Failed to restart session: ${extractErrorMessage(err)}`);
  }
}

/**
 * Logs out the current session (invalidates the WhatsApp auth).
 */
export async function logoutSession() {
  try {
    await wahaClient.post(`/api/sessions/${SESSION}/logout`);
    console.log(`Session "${SESSION}" logged out.`);
  } catch (err) {
    throw new Error(`Failed to logout session: ${extractErrorMessage(err)}`);
  }
}

/**
 * Deletes the current session entirely.
 */
export async function deleteSession() {
  try {
    await wahaClient.delete(`/api/sessions/${SESSION}`);
    console.log(`Session "${SESSION}" deleted.`);
  } catch (err) {
    if (err.response?.status === 404) {
      console.log(`Session "${SESSION}" not found.`);
      return;
    }
    throw new Error(`Failed to delete session: ${extractErrorMessage(err)}`);
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

/**
 * Retrieves the QR code for the current session.
 * Only available when the session status is SCAN_QR_CODE.
 *
 * @returns {Promise<object>} - Object containing the QR code data.
 */
export async function getQRCode() {
  try {
    const res = await wahaClient.get(`/api/${SESSION}/auth/qr`, {
      headers: { Accept: "application/json" },
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 400) {
      throw new Error("QR code not available - session may not be in SCAN_QR_CODE state.");
    }
    if (err.response?.status === 404) {
      throw new Error("Session not found.");
    }
    throw new Error(`Failed to get QR code: ${extractErrorMessage(err)}`);
  }
}

/**
 * Requests a pairing code for the given phone number.
 * Use this as an alternative to QR code authentication.
 *
 * @param {string} phoneNumber - The phone number to pair with (E.164 format).
 * @returns {Promise<object>}  - Object containing the pairing code.
 */
export async function getPairingCode(phoneNumber) {
  if (!phoneNumber) throw new Error("phoneNumber is required");

  try {
    const res = await wahaClient.post(`/api/${SESSION}/auth/request-code`, { phoneNumber });
    return res.data;
  } catch (err) {
    if (err.response?.status === 400) {
      throw new Error("Invalid phone number format.");
    }
    throw new Error(`Failed to get pairing code: ${extractErrorMessage(err)}`);
  }
}
