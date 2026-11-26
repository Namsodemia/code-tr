#!/bin/bash
# Coder.app'i ve Vercel'e yuklenecek site klasorunu uretir.
#   ./build.sh            -> dist/Coder.app, dist/Coder-mac.zip, site/
#   ./build.sh install    -> ayrica /Applications/Coder.app'i gunceller
set -e
cd "$(dirname "$0")"
VERSION=$(grep -m1 '^VERSION' web/server.py | cut -d'"' -f2)
rm -rf dist site && mkdir -p dist site

APP="dist/Code-Tr.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp mac/launcher.sh "$APP/Contents/MacOS/Coder" && chmod +x "$APP/Contents/MacOS/Coder"
cp web/server.py web/index.html "$APP/Contents/Resources/"
mkdir -p "$APP/Contents/Resources/fonts" && cp web/fonts/* "$APP/Contents/Resources/fonts/"
cp brand/icon-32.png brand/icon-64.png brand/icon-192.png brand/icon-512.png "$APP/Contents/Resources/"
echo "$VERSION" > "$APP/Contents/Resources/VERSION"

# simge
ICONSET=$(mktemp -d)/Coder.iconset; mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s brand/app-icon-1024.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) brand/app-icon-1024.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Coder.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Code-Tr</string>
  <key>CFBundleDisplayName</key><string>Code-Tr</string>
  <key>CFBundleIdentifier</key><string>app.codetr.desktop</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>Coder</string>
  <key>CFBundleIconFile</key><string>Coder</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true
(cd dist && ditto -c -k --keepParent Code-Tr.app Code-Tr-mac.zip)

# web sitesi (Vercel)
sed "s/__CODER_VERSION__/$VERSION/g" web/index.html > site/index.html
cp dist/Code-Tr-mac.zip site/Code-Tr-mac.zip
cp brand/icon-32.png brand/icon-64.png brand/icon-192.png brand/icon-512.png brand/icon-maskable-512.png brand/apple-touch-icon.png site/
cp brand/icon-512.png site/icon.png
mkdir -p site/fonts && cp web/fonts/* site/fonts/
cp web/manifest.webmanifest web/sw.js site/
mkdir -p site/api && cp web/api/*.js site/api/
cp web/version.json site/version.json
CONTACT=$(cat mac/contact.txt 2>/dev/null || echo "iletisim@coder-tr.vercel.app")
python3 - "$CONTACT" <<'PY'
import sys
contact=sys.argv[1]
tpl=open("web/legal/_page.html",encoding="utf-8").read()
for name,title in (("gizlilik","Gizlilik Politikası"),("kullanim-sartlari","Kullanım Şartları"),("hakkinda","Hakkında")):
    body=open(f"web/legal/{name}.body.html",encoding="utf-8").read()
    open(f"site/{name}.html","w",encoding="utf-8").write(tpl.replace("__TITLE__",title).replace("__BODY__",body).replace("__CONTACT__",contact))
PY
echo '{"private": true, "type": "module"}' > site/package.json
sed -i '' 's#<title>Coder</title>#<title>Coder</title>\n<link rel="icon" href="/icon.png">#' site/index.html
cat > site/vercel.json <<'JSON'
{
  "headers": [
    {"source": "/(.*)", "headers": [
      {"key": "X-Content-Type-Options", "value": "nosniff"},
      {"key": "Referrer-Policy", "value": "no-referrer"},
      {"key": "X-Frame-Options", "value": "DENY"}
    ]},
    {"source": "/sw.js", "headers": [
      {"key": "Cache-Control", "value": "no-cache"},
      {"key": "Service-Worker-Allowed", "value": "/"}
    ]},
    {"source": "/fonts/(.*)", "headers": [
      {"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}
    ]},
    {"source": "/version.json", "headers": [
      {"key": "Access-Control-Allow-Origin", "value": "*"},
      {"key": "Cache-Control", "value": "no-store"}
    ]},
    {"source": "/Code-Tr-mac.zip", "headers": [
      {"key": "Content-Disposition", "value": "attachment; filename=Code-Tr-mac.zip"}
    ]}
  ]
}
JSON
# duman testi: sayfa betigi gorunmez tarayicida sonuna kadar hatasiz calismali
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  if ! "$CHROME" --headless=new --disable-gpu --virtual-time-budget=4000 --dump-dom "file://$PWD/site/index.html" 2>/dev/null | grep -q 'data-ok="1"'; then
    echo "HATA: sayfa betigi calismiyor (duman testi basarisiz) - yukleme durduruldu" >&2; exit 1
  fi
  echo "Duman testi gecti."
fi
echo "Surum $VERSION hazir: dist/Code-Tr-mac.zip ($(du -h dist/Code-Tr-mac.zip | cut -f1)), site/"

if [ "$1" = "install" ]; then
  pkill -f "Coder.app/Contents/Resources/coder_gui.py" 2>/dev/null || true
  rm -rf /Applications/Coder.app /Applications/Code-Tr.app && cp -R "$APP" /Applications/Code-Tr.app
  [ -L "$HOME/Desktop/Coder.app" ] && rm -f "$HOME/Desktop/Coder.app" && ln -s /Applications/Code-Tr.app "$HOME/Desktop/Code-Tr.app"
  echo "/Applications/Code-Tr.app guncellendi."
fi
