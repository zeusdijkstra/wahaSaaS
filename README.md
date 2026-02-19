# WhatsApp AI Bot

Your personal AI bot that runs 100% on your machine. As long as this is running, your bot is live.

---

## How It Works

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
│  WhatsApp User  │────▶│    WAHA      │────▶│  Webhook    │────▶│    AI      │
│  (Mobile App)   │◀────│  (Docker)    │◀────│  (Express)  │◀────│  (Claude)  │
└─────────────────┘     └──────────────┘     └─────────────┘     └────────────┘
```

### Startup Flow

1. **Load config** - Read `.env` (port, API keys, session name)
2. **Start webhook server** - Express app listens on port 3001
3. **Check existing session** - Call `listSessions()` to see if already connected
4. **If WORKING** - Skip creation, show ready banner
5. **If not** - Call `startSession(WEBHOOK_URL)` to create + wait for WhatsApp connection
6. **Ready** - Bot is live, waiting for messages

### Message Flow

```
User sends message
        │
        ▼
┌─────────────────────────────────────┐
│  WAHA receives (Docker)              │
│  WhatsApp Web → HTTP API             │
└─────────────────────────────────────┘
        │
        │ webhook POST /webhook
        ▼
┌─────────────────────────────────────┐
│  Express server (server.js)          │
│  1. Validate payload                 │
│  2. Filter: message? fromMe? group?│
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  AI module (ai.js)                   │
│  1. Get history for chatId          │
│  2. Call Claude with history         │
│  3. Return reply                    │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  WAHA (waha.js)                     │
│  POST /api/sendText                  │
└─────────────────────────────────────┘
        │
        ▼
WhatsApp delivers to user
```

---

## Quick Start

### 1. Initialize WAHA

```bash
docker run --rm -v "$(pwd)":/app/env devlikeapro/waha init-waha /app/env
```

This generates a `.env` file with credentials.

### 2. Configure the bot

Edit `.env` and set your Anthropic API key:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Start everything

```bash
./start.sh
```

### 4. Authenticate

1. Open http://localhost:3000/dashboard
2. Login with admin credentials
3. Add your API key (check .env file)
4. Start a session and scan the QR code

---

## Files Overview

| File | Purpose |
|------|---------|
| `index.js` | Entry point - starts server + WAHA session |
| `waha.js` | WAHA API wrapper - all HTTP calls to WAHA |
| `server.js` | Express webhook server - receives events, sends replies |
| `ai.js` | Claude AI wrapper - manages conversation history |

---

## Configuration (.env)

### WAHA Variables (auto-generated)

| Variable | Description |
|----------|-------------|
| `WAHA_API_KEY` | Your API key for WAHA |
| `WAHA_DASHBOARD_USERNAME` | Dashboard login |
| `WAHA_DASHBOARD_PASSWORD` | Dashboard password |

### Bot Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **required** | Your Anthropic API key |
| `WAHA_URL` | `http://localhost:3000` | Where Waha is running |
| `WAHA_SESSION` | `default` | Waha session name |
| `WEBHOOK_PORT` | `3001` | Our server port |
| `BOT_SYSTEM_PROMPT` | helpful assistant | Controls the bot's personality |
| `PRIVATE_ONLY` | `true` | If true, ignores group chats |

### Optional: Session Config

| Variable | Default | Description |
|----------|---------|-------------|
| `WAHA_DEBUG` | `false` | Enable debug mode |
| `WAHA_CLIENT_DEVICE_NAME` | `WAHABot` | Device name in WhatsApp |
| `WAHA_IGNORE_GROUPS` | `false` | Ignore group messages |
| `WAHA_IGNORE_STATUS` | `false` | Ignore status updates |
| `WAHA_PROXY_SERVER` | - | Proxy server (e.g., `localhost:3128`) |

---

## Special Commands (send via WhatsApp)

| Command | Effect |
|---------|--------|
| `/reset` | Clears conversation history for that chat |

---

## Check Bot Status

```
http://localhost:3001/status
```

Returns active conversations and message counts.

---

## Troubleshooting

### WAHA not running
```bash
docker start waha
```

### Re-scan QR code
```bash
docker restart waha
```

### View WAHA logs
```bash
docker logs waha
```
