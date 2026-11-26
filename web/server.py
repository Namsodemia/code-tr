#!/usr/bin/env python3
"""Coder — Claude benzeri masaustu asistan icin yerel sunucu.

Yalnizca Python standart kutuphanesi kullanir (macOS'taki /usr/bin/python3 yeter).

Ozellikler
- Iki model kaynagi: yerel Ollama (internetsiz) ve OpenAI uyumlu bulut API
  (varsayilan OpenRouter; ucretsiz ":free" modeller listelenebilir).
- Cevaplar akarak gelir (streaming).
- Gorsel ekleme (gorsel destekli modellerde), PDF ve metin dosyasi ekleme.
  Taranmis (metinsiz) PDF'ler gorsel modele sayfa resmi olarak gonderilir.
- "Ajan" modu: secilen klasorde dosya okur/yazar/duzenler, komut calistirir.
  Yazma ve komutlar arayuzde onay ister.

Guvenlik: sunucu yalnizca 127.0.0.1'i dinler; her API cagrisi acilista uretilen
gizli anahtari (X-Coder-Token) ve dogru Host basligini ister. Boylece baska bir
web sitesi bu sunucuya istek atamaz.
"""
import base64
import glob
import json
import os
import queue
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = os.path.dirname(os.path.abspath(__file__))
VERSION = "1.1.0"
PORT = int(os.environ.get("CODER_PORT", "8777"))
TOKEN = secrets.token_urlsafe(24)
DATA_DIR = Path.home() / "Library" / "Application Support" / "Coder"
SETTINGS_FILE = DATA_DIR / "settings.json"
MAX_TOOL_CHARS = 6000
MAX_STEPS = 15
PATH_EXTRA = ["/opt/homebrew/bin", "/usr/local/bin"]
os.environ["PATH"] = os.pathsep.join(PATH_EXTRA + [os.environ.get("PATH", "")])

DEFAULTS = {
    "ollama_url": "http://localhost:11434",
    "cloud_base": "https://openrouter.ai/api/v1",
    "cloud_key": "",
    "cloud_models": [],          # [{"id": "...", "name": "...", "vision": bool}]
    "workspace": str(Path.home()),
}

_settings_lock = threading.Lock()


def load_settings():
    s = dict(DEFAULTS)
    try:
        s.update(json.loads(SETTINGS_FILE.read_text("utf-8")))
    except Exception:
        pass
    return s


def save_settings(s):
    with _settings_lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = SETTINGS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(s, ensure_ascii=False, indent=2), "utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(SETTINGS_FILE)


# --------------------------------------------------------------------------- #
# Model kaynaklari
# --------------------------------------------------------------------------- #
VISION_HINTS = ("vision", "llava", "gemma3", "qwen2.5vl", "qwen2.5-vl", "qwen3-vl",
                "moondream", "minicpm-v", "bakllava", "granite3.2-vision", "llama4")


def http_json(url, payload=None, headers=None, timeout=15):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers or {},
                                 method="POST" if data else "GET")
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


_vision_cache = {}


def ollama_models(s):
    base = s["ollama_url"].rstrip("/")
    try:
        tags = http_json(base + "/api/tags", timeout=4)
    except Exception:
        return None
    out = []
    for m in tags.get("models", []):
        name = m.get("name", "")
        if name not in _vision_cache:
            vision = any(h in name.lower() for h in VISION_HINTS)
            try:
                caps = http_json(base + "/api/show", {"model": name}, timeout=5).get("capabilities") or []
                if caps:
                    vision = "vision" in caps
            except Exception:
                pass
            _vision_cache[name] = vision
        out.append({"id": "ollama:" + name, "name": name, "vision": _vision_cache[name],
                    "size": m.get("size", 0)})
    return out


def openrouter_free(s):
    base = s["cloud_base"].rstrip("/")
    data = http_json(base + "/models", timeout=20)
    out = []
    for m in data.get("data", []):
        mid = m.get("id", "")
        pricing = m.get("pricing") or {}
        free = mid.endswith(":free") or (str(pricing.get("prompt")) == "0" and str(pricing.get("completion")) == "0")
        if not free:
            continue
        mods = (m.get("architecture") or {}).get("input_modalities") or []
        out.append({"id": mid, "name": m.get("name", mid), "vision": "image" in mods,
                    "context": m.get("context_length", 0)})
    out.sort(key=lambda x: (-int(x.get("context") or 0), x["name"]))
    return out


def model_info(s, model_id):
    """(saglayici, model adi, gorsel destegi)"""
    if model_id.startswith("ollama:"):
        name = model_id[len("ollama:"):]
        return "ollama", name, _vision_cache.get(name, any(h in name.lower() for h in VISION_HINTS))
    name = model_id[len("cloud:"):] if model_id.startswith("cloud:") else model_id
    vis = any(m.get("vision") for m in s.get("cloud_models", []) if m.get("id") == name)
    return "cloud", name, vis


class Cancelled(Exception):
    pass


def stream_chat(s, model_id, messages, on_token, cancel):
    """Modeli akarak calistirir, tam metni dondurur.

    messages: [{"role", "content", "images": [b64...]}]
    """
    provider, name, _ = model_info(s, model_id)
    if provider == "ollama":
        url = s["ollama_url"].rstrip("/") + "/api/chat"
        payload = {"model": name, "messages": messages, "stream": True,
                   "options": {"temperature": 0.3, "num_ctx": 8192}}
        headers = {"Content-Type": "application/json"}
    else:
        if not s.get("cloud_key"):
            raise RuntimeError("Bulut modeli icin API anahtari gerekli. Ayarlar'dan ekleyin.")
        url = s["cloud_base"].rstrip("/") + "/chat/completions"
        msgs = []
        for m in messages:
            imgs = m.get("images") or []
            if imgs:
                parts = [{"type": "text", "text": m.get("content", "")}]
                for b in imgs:
                    parts.append({"type": "image_url",
                                  "image_url": {"url": "data:image/png;base64," + b}})
                msgs.append({"role": m["role"], "content": parts})
            else:
                msgs.append({"role": m["role"], "content": m.get("content", "")})
        payload = {"model": name, "messages": msgs, "stream": True, "temperature": 0.3}
        headers = {"Content-Type": "application/json",
                   "Authorization": "Bearer " + s["cloud_key"],
                   "HTTP-Referer": "http://localhost", "X-Title": "Coder"}

    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    full = []
    try:
        resp = urllib.request.urlopen(req, timeout=600)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        try:
            j = json.loads(detail)
            detail = (j.get("error") or {}).get("message") if isinstance(j.get("error"), dict) else j.get("error") or detail
        except Exception:
            pass
        if e.code == 429:
            detail = "Ucretsiz modelin limiti doldu, biraz bekleyin ya da baska model secin. (" + str(detail)[:200] + ")"
        raise RuntimeError("Model hatasi (%s): %s" % (e.code, str(detail)[:400]))
    except urllib.error.URLError as e:
        if provider == "ollama":
            raise RuntimeError("Ollama'ya baglanilamadi. Ollama uygulamasi acik mi? (%s)" % e.reason)
        raise RuntimeError("Internet baglantisi yok ya da adres hatali (%s)" % e.reason)

    with resp:
        for raw in resp:
            if cancel.is_set():
                raise Cancelled()
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            if provider == "ollama":
                try:
                    j = json.loads(line)
                except Exception:
                    continue
                if j.get("error"):
                    raise RuntimeError(j["error"])
                piece = (j.get("message") or {}).get("content", "")
                if piece:
                    full.append(piece)
                    on_token(piece)
                if j.get("done"):
                    break
            else:
                if not line.startswith("data:"):
                    continue
                body = line[5:].strip()
                if body == "[DONE]":
                    break
                try:
                    j = json.loads(body)
                except Exception:
                    continue
                if j.get("error"):
                    err = j["error"]
                    raise RuntimeError(err.get("message") if isinstance(err, dict) else str(err))
                ch = (j.get("choices") or [{}])[0]
                piece = (ch.get("delta") or {}).get("content") or ""
                if piece:
                    full.append(piece)
                    on_token(piece)
    return "".join(full)


# --------------------------------------------------------------------------- #
# Ekler
# --------------------------------------------------------------------------- #
def pdf_text(path):
    try:
        r = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True,
                           text=True, timeout=90)
        if r.returncode == 0:
            return r.stdout
    except Exception:
        pass
    try:  # macOS yerlesik: PDFKit uzerinden
        script = ('use framework "PDFKit"\nset d to current application\'s PDFDocument\'s alloc()\'s '
                  'initWithURL:(current application\'s NSURL\'s fileURLWithPath:"%s")\nreturn (d\'s string()) as text'
                  % path.replace('"', '\\"'))
        r = subprocess.run(["osascript", "-l", "AppleScript", "-e", script], capture_output=True,
                           text=True, timeout=90)
        return r.stdout
    except Exception:
        return ""


def pdf_page_images(path, pages=3):
    if not shutil.which("pdftoppm"):
        return []
    out_dir = tempfile.mkdtemp(prefix="coder-pdf-")
    try:
        subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", "1", "-l", str(pages), path,
                        os.path.join(out_dir, "p")], capture_output=True, timeout=120)
        imgs = []
        for f in sorted(glob.glob(os.path.join(out_dir, "*.png"))):
            with open(f, "rb") as fh:
                imgs.append(base64.b64encode(fh.read()).decode())
        return imgs
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def process_attachments(atts, vision):
    """Ekleri (metin, gorseller, notlar) olarak dondurur."""
    texts, images, notes = [], [], []
    for att in atts or []:
        name = att.get("name", "dosya")
        mime = att.get("type", "")
        data = att.get("data", "")
        if "," in data[:100] and data.startswith("data:"):
            data = data.split(",", 1)[1]
        try:
            blob = base64.b64decode(data)
        except Exception:
            notes.append("%s okunamadi." % name)
            continue
        if mime.startswith("image/"):
            if vision:
                images.append(base64.b64encode(blob).decode())
            else:
                notes.append("'%s' gorseli bu modele gonderilmedi: secili model gorselleri goremiyor. "
                             "Model menusunden gorsel destekli (goz simgeli) bir model secin." % name)
        elif mime == "application/pdf" or name.lower().endswith(".pdf"):
            fd, path = tempfile.mkstemp(suffix=".pdf")
            with os.fdopen(fd, "wb") as f:
                f.write(blob)
            try:
                text = pdf_text(path).strip()
                if len(text) > 40:
                    if len(text) > 60000:
                        text = text[:60000] + "\n...[PDF kisaltildi]"
                    texts.append("[Ekli PDF: %s]\n%s" % (name, text))
                elif vision:
                    pages = pdf_page_images(path)
                    images.extend(pages)
                    texts.append("[Ekli PDF: %s — taranmis belge, ilk %d sayfa resim olarak eklendi]"
                                 % (name, len(pages)))
                else:
                    notes.append("'%s' taranmis bir PDF (metin yok). Okumak icin gorsel destekli model secin." % name)
            finally:
                os.unlink(path)
        else:
            txt = blob.decode("utf-8", errors="replace")
            if len(txt) > 60000:
                txt = txt[:60000] + "\n...[kisaltildi]"
            texts.append("[Ekli dosya: %s]\n```\n%s\n```" % (name, txt))
    return texts, images, notes


# --------------------------------------------------------------------------- #
# Ajan araclari
# --------------------------------------------------------------------------- #
def truncate(t):
    t = "" if t is None else str(t)
    return t if len(t) <= MAX_TOOL_CHARS else t[:MAX_TOOL_CHARS] + "\n...[kisaltildi, toplam %d karakter]" % len(t)


class Tools:
    def __init__(self, workspace, ask):
        self.ws = Path(workspace).expanduser().resolve()
        self.ask = ask  # ask(kind, title, detail) -> bool

    def p(self, path):
        q = Path(path or ".").expanduser()
        return (q if q.is_absolute() else self.ws / q).resolve()

    def list_dir(self, a):
        p = self.p(a.get("path"))
        if not p.is_dir():
            return "HATA: '%s' bir klasor degil." % p
        items = []
        for e in sorted(p.iterdir())[:400]:
            if e.name in (".git", "node_modules", "__pycache__", ".DS_Store"):
                continue
            items.append(e.name + ("/" if e.is_dir() else ""))
        return "\n".join(items) or "(bos)"

    def read_file(self, a):
        p = self.p(a.get("path"))
        if not p.is_file():
            return "HATA: '%s' bulunamadi." % p
        if p.suffix.lower() == ".pdf":
            return truncate(pdf_text(str(p)))
        lines = p.read_text("utf-8", errors="replace").splitlines()
        start = max(1, int(a.get("start") or 1))
        end = int(a.get("end") or 0) or len(lines)
        body = "\n".join("%d: %s" % (i, l) for i, l in enumerate(lines[start - 1:end], start))
        return truncate("# %s (satir %d-%d / %d)\n%s" % (p, start, min(end, len(lines)), len(lines), body))

    def write_file(self, a):
        p = self.p(a.get("path"))
        content = a.get("content", "")
        if not self.ask("write", "Dosya yazilsin mi?", "%s\n\n%s" % (p, content[:3000])):
            return "Kullanici yazmayi reddetti."
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, "utf-8")
        return "'%s' yazildi (%d karakter)." % (p, len(content))

    def edit_file(self, a):
        p = self.p(a.get("path"))
        old, new = a.get("old", ""), a.get("new", "")
        if not p.is_file():
            return "HATA: '%s' bulunamadi." % p
        text = p.read_text("utf-8", errors="replace")
        n = text.count(old) if old else 0
        if n == 0:
            return ("HATA: 'old' metni dosyada birebir bulunamadi. Dosyanin gercek icerigi asagida; "
                    "'old' alanina buradan birebir kopyala:\n" + truncate(text[:4000]))
        if n > 1:
            return "HATA: metin %d yerde geciyor; daha fazla satir ekleyerek benzersiz yap." % n
        if not self.ask("write", "Dosya duzenlensin mi?", "%s\n\n--- eski\n%s\n\n+++ yeni\n%s" % (p, old[:1500], new[:1500])):
            return "Kullanici duzenlemeyi reddetti."
        p.write_text(text.replace(old, new, 1), "utf-8")
        return "'%s' duzenlendi." % p

    def grep(self, a):
        pat = a.get("pattern", "")
        p = self.p(a.get("path"))
        rg = shutil.which("rg")
        cmd = [rg, "-n", "--no-heading", "-S", pat, str(p)] if rg else \
            ["grep", "-rnE", "--exclude-dir=node_modules", "--exclude-dir=.git", pat, str(p)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return truncate((r.stdout or r.stderr).strip() or "(eslesme yok)")

    def run_command(self, a):
        cmd = a.get("command", "")
        if not self.ask("command", "Komut calistirilsin mi?", "%s\n\n$ %s" % (self.ws, cmd)):
            return "Kullanici komutu reddetti."
        try:
            r = subprocess.run(cmd, shell=True, cwd=str(self.ws), capture_output=True, text=True, timeout=180)
        except subprocess.TimeoutExpired:
            return "HATA: komut 180 sn icinde bitmedi."
        out = (r.stdout or "") + (("\n[stderr]\n" + r.stderr) if r.stderr else "")
        return truncate(out.strip() + "\n[cikis kodu: %d]" % r.returncode)


TOOL_NAMES = ("list_dir", "read_file", "write_file", "edit_file", "grep", "run_command")

AGENT_PROMPT = """Sen Coder'sin: kullanicinin bilgisayarinda calisan yetenekli bir yazilim asistanisin.
Calisma klasoru: {ws}
Isletim sistemi: macOS

Bir arac kullanmak istediginde cevabin YALNIZCA tek bir JSON nesnesi olsun, baska yazi ekleme:
{{"action": "ARAC", "args": {{...}}}}

Araclar:
- list_dir    {{"path": "."}}
- read_file   {{"path": "dosya", "start": 1, "end": 200}}
- write_file  {{"path": "dosya", "content": "tam icerik"}}      (yeni dosya ya da tamamen yeniden yazma)
- edit_file   {{"path": "dosya", "old": "birebir eski metin", "new": "yeni metin"}}   (kucuk degisiklik)
- grep        {{"pattern": "regex", "path": "."}}
- run_command {{"command": "kabuk komutu"}}

Arac sonucu sana "ARAC_SONUCU" olarak gelir. Is bitince ya da arac gerekmiyorsa JSON YAZMADAN,
dogrudan kullaniciya normal metinle (Markdown) cevap ver.

Ornek:
Kullanici: README dosyasini oku
Sen: {{"action": "read_file", "args": {{"path": "README.md"}}}}

Klasorun su anki icerigi:
{listing}

Kurallar:
- Tahmin etme; once list_dir / read_file ile bak.
- Mevcut dosyada kucuk degisiklik icin edit_file kullan.
- Ayni anda yalnizca TEK arac cagir.
- Kullanicinin dilinde (genelde Turkce) cevap ver, kisa ve net ol.
"""

CHAT_PROMPT = ("Sen Coder'sin: yardimsever, bilgili ve samimi bir asistansin. Kullanicinin dilinde "
               "(genelde Turkce) cevap ver. Net ve dogru ol; bilmiyorsan uydurma, soyle. Kod gerekiyorsa "
               "Markdown kod blogu kullan. Ekli gorsel/PDF varsa icerigine dayanarak cevap ver.")


def extract_action(text):
    t = text.strip()
    cands = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", t, re.S) + [t]
    dec = json.JSONDecoder()
    for c in cands:
        i = c.find("{")
        while i != -1:
            try:
                obj, _ = dec.raw_decode(c[i:])
                if isinstance(obj, dict) and obj.get("action") in TOOL_NAMES:
                    return obj
            except ValueError:
                pass
            i = c.find("{", i + 1)
    return None


# --------------------------------------------------------------------------- #
# Calisma (bir istek = bir "run")
# --------------------------------------------------------------------------- #
APPROVALS = {}   # id -> [Event, sonuc]


def run_request(req, emit, cancel):
    s = load_settings()
    model_id = req.get("model", "")
    mode = req.get("mode", "chat")
    history = req.get("messages", [])
    provider, name, vision = model_info(s, model_id)

    texts, images, notes = process_attachments(req.get("attachments"), vision)
    for n in notes:
        emit({"type": "notice", "text": n})
    if texts:
        emit({"type": "att_text", "text": "\n\n".join(texts)})

    msgs = []
    for i, m in enumerate(history):
        content = m.get("content", "")
        if m.get("extra"):
            content = content + "\n\n" + m["extra"]
        if i == len(history) - 1 and m.get("role") == "user":
            if texts:
                content = content + "\n\n" + "\n\n".join(texts)
            msg = {"role": "user", "content": content}
            if images:
                msg["images"] = images
            msgs.append(msg)
        else:
            msgs.append({"role": m.get("role", "user"), "content": content})

    def on_token(t):
        emit({"type": "token", "text": t})

    if mode != "agent":
        sysmsg = {"role": "system", "content": CHAT_PROMPT}
        text = stream_chat(s, model_id, [sysmsg] + msgs, on_token, cancel)
        emit({"type": "final", "text": text})
        return

    ws = req.get("workspace") or s.get("workspace") or str(Path.home())

    def ask(kind, title, detail):
        aid = secrets.token_hex(6)
        ev = threading.Event()
        APPROVALS[aid] = [ev, False]
        emit({"type": "approval", "id": aid, "kind": kind, "title": title, "detail": detail})
        while not ev.wait(0.5):
            if cancel.is_set():
                APPROVALS.pop(aid, None)
                raise Cancelled()
        return APPROVALS.pop(aid)[1]

    tools = Tools(ws, ask)
    try:
        listing = tools.list_dir({"path": "."})[:2500]
    except Exception:
        listing = "(okunamadi)"
    convo = [{"role": "system", "content": AGENT_PROMPT.format(ws=tools.ws, listing=listing)}] + msgs
    nudges = 0
    for step in range(1, MAX_STEPS + 1):
        emit({"type": "step_start", "step": step})
        reply = stream_chat(s, model_id, convo, on_token, cancel)
        action = extract_action(reply)
        if not action:
            bad = reply.strip()
            intent = re.search(r"(al[ıi]m|el[ıi]m|ay[ıi]m|ey[ıi]m)[.:!…]*\s*$", bad[-60:])
            if nudges < 2 and (len(bad) < 25 or bad.startswith("ARAC") or '"action"' in bad or intent):
                # kucuk modeller formati karistirabiliyor: bir kez hatirlat
                nudges += 1
                convo.append({"role": "assistant", "content": reply})
                convo.append({"role": "user", "content": "Soyledigini simdi yap: tek bir arac JSON'u yaz "
                              "(ornek: {\"action\": \"read_file\", \"args\": {\"path\": \"index.html\"}}) "
                              "ya da kullaniciya normal metinle cevap ver."})
                continue
            if bad.startswith("{") and '"action"' in bad:
                reply = "Tamamlandı. Yapılan adımlar yukarıda."
            emit({"type": "final", "text": reply})
            return
        tname = action["action"]
        args = action.get("args") if isinstance(action.get("args"), dict) else {}
        emit({"type": "tool", "step": step, "name": tname, "args": args})
        try:
            result = getattr(tools, tname)(args)
        except Cancelled:
            raise
        except Exception as e:
            result = "HATA: %s" % e
        emit({"type": "tool_result", "step": step, "name": tname, "result": result})
        convo.append({"role": "assistant", "content": json.dumps(action, ensure_ascii=False)})
        convo.append({"role": "user", "content": "ARAC_SONUCU (%s):\n%s" % (tname, result)})
    emit({"type": "final", "text": "%d adim sinirina ulasildi. Devam etmemi istersen 'devam' yaz." % MAX_STEPS})


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, *a):
        pass

    def _ok_host(self):
        return self.headers.get("Host", "") in ("127.0.0.1:%d" % PORT, "localhost:%d" % PORT)

    def _authed(self):
        return self._ok_host() and secrets.compare_digest(self.headers.get("X-Coder-Token", ""), TOKEN)

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode() or "{}")

    def do_GET(self):
        if not self._ok_host():
            return self.send_error(403)
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            html = Path(ROOT, "index.html").read_text("utf-8").replace("__CODER_TOKEN__", TOKEN).replace("__CODER_VERSION__", VERSION)
            body = html.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/health":
            return self._json({"ok": True, "app": "coder", "v": VERSION})
        if not self._authed():
            return self.send_error(403)
        s = load_settings()
        if path == "/api/models":
            local = ollama_models(s)
            cloud = [{"id": "cloud:" + m["id"], "name": m.get("name", m["id"]), "vision": m.get("vision", False)}
                     for m in s.get("cloud_models", [])]
            return self._json({"local": local or [], "ollama_ok": local is not None,
                               "cloud": cloud, "cloud_ready": bool(s.get("cloud_key"))})
        if path == "/api/settings":
            pub = dict(s)
            pub["cloud_key"] = ("•" * 8 + s["cloud_key"][-4:]) if s.get("cloud_key") else ""
            pub["has_key"] = bool(s.get("cloud_key"))
            return self._json(pub)
        if path == "/api/free-models":
            try:
                return self._json({"models": openrouter_free(s)})
            except Exception as e:
                return self._json({"error": "Liste alinamadi: %s" % e}, 502)
        self.send_error(404)

    def do_POST(self):
        if not self._authed():
            return self.send_error(403)
        path = self.path
        try:
            data = self._body()
        except Exception:
            return self._json({"error": "gecersiz istek"}, 400)

        if path == "/api/settings":
            s = load_settings()
            for k in ("ollama_url", "cloud_base", "workspace"):
                if isinstance(data.get(k), str) and data[k].strip():
                    s[k] = data[k].strip()
            if isinstance(data.get("cloud_key"), str) and "•" not in data["cloud_key"]:
                s["cloud_key"] = data["cloud_key"].strip()
            if isinstance(data.get("cloud_models"), list):
                s["cloud_models"] = [m for m in data["cloud_models"] if isinstance(m, dict) and m.get("id")]
            save_settings(s)
            return self._json({"ok": True})

        if path == "/api/pick-folder":
            r = subprocess.run(["osascript", "-e",
                                'POSIX path of (choose folder with prompt "Coder calisma klasorunu sec")'],
                               capture_output=True, text=True)
            folder = r.stdout.strip()
            if folder:
                s = load_settings()
                s["workspace"] = folder.rstrip("/") or "/"
                save_settings(s)
            return self._json({"folder": folder.rstrip("/")})

        if path == "/api/approve":
            item = APPROVALS.get(data.get("id", ""))
            if item:
                item[1] = bool(data.get("ok"))
                item[0].set()
            return self._json({"ok": bool(item)})

        if path == "/api/pull":
            return self._stream(lambda emit, cancel: self._pull(data.get("model", ""), emit, cancel))

        if path == "/api/chat":
            return self._stream(lambda emit, cancel: run_request(data, emit, cancel))
        self.send_error(404)

    def _pull(self, model, emit, cancel):
        s = load_settings()
        req = urllib.request.Request(s["ollama_url"].rstrip("/") + "/api/pull",
                                     data=json.dumps({"model": model, "stream": True}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=3600) as r:
            for raw in r:
                if cancel.is_set():
                    raise Cancelled()
                j = json.loads(raw.decode() or "{}")
                emit({"type": "progress", "status": j.get("status", ""),
                      "done": j.get("completed", 0), "total": j.get("total", 0)})
        _vision_cache.pop(model, None)
        emit({"type": "final", "text": "ok"})

    def _stream(self, work):
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        q = queue.Queue()
        cancel = threading.Event()

        def emit(ev):
            q.put(ev)

        def runner():
            try:
                work(emit, cancel)
            except Cancelled:
                pass
            except Exception as e:
                q.put({"type": "error", "text": str(e)})
            finally:
                q.put(None)

        threading.Thread(target=runner, daemon=True).start()
        last = time.time()
        while True:
            try:
                ev = q.get(timeout=10)
            except queue.Empty:
                ev = {"type": "ping"}
            if ev is None:
                break
            try:
                self.wfile.write((json.dumps(ev, ensure_ascii=False) + "\n").encode())
                self.wfile.flush()
                last = time.time()
            except (BrokenPipeError, ConnectionResetError, OSError):
                cancel.set()
                break
        _ = last


def main():
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        print("Port %d dolu; Coder zaten calisiyor olabilir." % PORT, flush=True)
        sys.exit(3)
    server.daemon_threads = True
    print("Coder: http://127.0.0.1:%d" % PORT, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
