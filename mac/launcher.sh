#!/bin/bash
# Code-Tr.app baslaticisi: yerel sunucuyu baslatir ve arayuzu uygulama penceresinde acar.
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
VERSION="$(cat "$RES/VERSION" 2>/dev/null)"
PORT=8777
URL="http://127.0.0.1:$PORT/"
LOG="$HOME/Library/Logs/Coder.log"

running_ok() { curl -fs "${URL}health" 2>/dev/null | grep -q "\"v\": \"$VERSION\""; }

if ! running_ok; then
  # portu tutan eski bir Coder sunucusu varsa kapat (baska programlara dokunma)
  for pid in $(lsof -ti tcp:$PORT 2>/dev/null); do
    ps -o command= -p "$pid" | grep -q "server.py" && kill "$pid"
  done
  sleep 0.5
  if [ ! -x /usr/bin/python3 ] || ! /usr/bin/python3 -c "import sys" >/dev/null 2>&1; then
    osascript -e 'display dialog "Code-Tr için Python gerekiyor. Açılan pencereden \"Komut Satırı Geliştirici Araçları\"nı yükleyip Code-Tr'"'"'yi yeniden aç." buttons {"Tamam"} with icon caution' >/dev/null 2>&1
    xcode-select --install >/dev/null 2>&1
    exit 1
  fi
  nohup /usr/bin/python3 "$RES/server.py" >>"$LOG" 2>&1 &
  for _ in $(seq 1 60); do running_ok && break; sleep 0.25; done
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL" --window-size=1180,820
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$URL" --window-size=1180,820
else
  open "$URL"
fi
