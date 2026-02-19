#!/bin/bash
set -euo pipefail

WAHA_CONTAINER_NAME="waha"
WAHA_STARTUP_WAIT=3

echo "-----------------------------------------------------------"
echo "  Starting WhatsApp AI Bot"
echo "-----------------------------------------------------------"

if [ ! -f .env ]; then
    echo "ERROR: .env file not found."
    echo "  Run: docker run --rm -v \$(pwd):/app/env devlikeapro/waha init-waha /app/env"
    exit 1
fi

if grep -q "YourKeyHere" .env; then
    echo "ERROR: ANTHROPIC_API_KEY is not set in .env. Please update it before starting."
    exit 1
fi

if docker ps --format '{{.Names}}' | grep -q "^${WAHA_CONTAINER_NAME}$"; then
    echo "WAHA container is already running."
else
    echo "Starting WAHA container..."
    docker run -d \
        --env-file .env \
        -v "$(pwd)/sessions:/app/.sessions" \
        -p 3000:3000 \
        --name "$WAHA_CONTAINER_NAME" \
        devlikeapro/waha

    echo "Waiting ${WAHA_STARTUP_WAIT}s for WAHA to initialize..."
    sleep "$WAHA_STARTUP_WAIT"
fi

echo "Starting AI bot..."
npm start
