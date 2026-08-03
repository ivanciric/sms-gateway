#!/bin/bash
# Privremeno isključi kiosk autostart (npr. posle belog ekrana).

AUTOSTART="$HOME/.config/autostart/sms-gateway-kiosk.desktop"
DISABLED="$HOME/.config/autostart/sms-gateway-kiosk.desktop.disabled"

if [[ -f "$AUTOSTART" ]]; then
  mv "$AUTOSTART" "$DISABLED"
  echo "Kiosk autostart disabled."
  echo "Reboot ili logout/login da vidiš normalan desktop."
  echo "Za ponovno uključivanje: mv '$DISABLED' '$AUTOSTART'"
else
  echo "Autostart fajl nije pronađen: $AUTOSTART"
fi
