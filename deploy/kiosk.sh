#!/bin/bash
# Waits for desktop + SMS Gateway, then opens Chromium in kiosk mode.

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080/status}"
MAX_WAIT=180
LOG_FILE="${LOG_FILE:-$HOME/sms-gateway/data/kiosk.log}"

mkdir -p "$(dirname "$LOG_FILE")"
exec >>"$LOG_FILE" 2>&1

echo "=== kiosk start $(date -Iseconds) ==="

export DISPLAY="${DISPLAY:-:0}"

# Sačekaj da se desktop potpuno podigne
sleep 10

# Disable screen blanking (X11 desktop)
if command -v xset >/dev/null 2>&1; then
  xset s off
  xset -dpms
  xset s noblank
fi

echo "Waiting for SMS Gateway..."
ready=0
for ((i = 1; i <= MAX_WAIT; i++)); do
  if curl -sf "http://127.0.0.1:8080/health" >/dev/null && curl -sf "$GATEWAY_URL" >/dev/null; then
    ready=1
    echo "Gateway ready after ${i}s"
    break
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "Gateway not ready after ${MAX_WAIT}s, opening anyway"
fi

if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 3 &
fi

CHROMIUM=""
for bin in chromium-browser chromium google-chrome; do
  if command -v "$bin" >/dev/null 2>&1; then
    CHROMIUM="$bin"
    break
  fi
done

if [[ -z "$CHROMIUM" ]]; then
  echo "Chromium not found"
  exit 1
fi

echo "Launching $CHROMIUM -> $GATEWAY_URL"

exec "$CHROMIUM" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --no-first-run \
  --disable-session-crashed-bubble \
  --disable-gpu \
  --check-for-update-interval=31536000 \
  "$GATEWAY_URL"
