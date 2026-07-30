#!/bin/bash
# Waits for SMS Gateway, then opens Chromium in kiosk mode.

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080/status}"
MAX_WAIT=120

export DISPLAY="${DISPLAY:-:0}"

# Disable screen blanking (X11 desktop)
if command -v xset >/dev/null 2>&1; then
  xset s off
  xset -dpms
  xset s noblank
fi

echo "Waiting for SMS Gateway..."
for ((i = 1; i <= MAX_WAIT; i++)); do
  if curl -sf "http://127.0.0.1:8080/health" >/dev/null; then
    break
  fi
  sleep 1
done

# Hide mouse cursor after 3s idle (optional, install unclutter)
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
  echo "Chromium not found" >&2
  exit 1
fi

exec "$CHROMIUM" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --no-first-run \
  --check-for-update-interval=31536000 \
  "$GATEWAY_URL"
