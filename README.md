# WhatsApp AI Bot — Core Engine

Your personal AI bot that runs 100% on your machine. As long as this is running, your bot is live.

---

## Quick Start

### 1. Start Waha (WhatsApp gateway)
```bash
docker run -it -p 3000:3000 devlikeapro/waha
```
Then open http://localhost:3000 in your browser, scan the QR code with your WhatsApp — you're connected.

### 2. Configure the bot
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Install & run
```bash
npm install
npm start
```

That's it. Anyone who messages you on WhatsApp now gets an AI reply.

---

## How it works

```
Someone messages you on WhatsApp
        ↓
Waha receives it (port 3000)
        ↓
Fires webhook to our Node.js server (port 3001)
        ↓
We send it to Claude AI
        ↓
Claude replies → we send it back via Waha → WhatsApp
```

---

## Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Your Anthropic API key |
| `WAHA_URL` | `http://localhost:3000` | Where Waha is running |
| `WAHA_SESSION` | `default` | Waha session name |
| `WEBHOOK_PORT` | `3001` | Our server port |
| `BOT_SYSTEM_PROMPT` | helpful assistant | Controls the bot's personality |
| `PRIVATE_ONLY` | `true` | If true, ignores group chats |

---

## Special commands (send via WhatsApp)

| Command | Effect |
|---|---|
| `/reset` | Clears conversation history for that chat |

---

## Check bot status

```
http://localhost:3001/status
```
Returns active conversations and message counts.

---

## Next steps (coming soon)
- Electron desktop UI (no terminal needed)
- Auto-start Docker + Waha on app launch
- QR code scanner built into the app
- Per-contact custom prompts
- Message logs & analytics
