#!/usr/bin/env python3
"""Kucuk, bagimsiz bir kodlama ajanı CLI'i (Claude Code benzeri).

Sadece Python standart kutuphanesi kullanir; kurulum gerekmez.
Yerel Ollama ile (internet/anahtar yok) veya herhangi bir
OpenAI-uyumlu API ile calisir.

Kullanim:
  python3 coder.py                 # interaktif REPL
  python3 coder.py "gorev metni"   # tek seferlik
  python3 coder.py --yes "gorev"   # komut/yazma onayi sormadan

Ortam degiskenleri:
  CODER_PROVIDER  ollama | openai        (varsayilan: ollama)
  CODER_MODEL     model adi              (varsayilan: qwen2.5-coder:3b)
  CODER_BASE_URL  openai icin tam URL     (orn. https://openrouter.ai/api/v1/chat/completions)
                  ollama icin sunucu       (varsayilan: http://localhost:11434)
  CODER_API_KEY   openai icin anahtar
  CODER_MAX_STEPS ajan adim siniri        (varsayilan: 12)
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROVIDER = os.environ.get("CODER_PROVIDER", "ollama").lower()
MODEL = os.environ.get("CODER_MODEL", "qwen2.5-coder:3b")
BASE_URL = os.environ.get("CODER_BASE_URL", "")
API_KEY = os.environ.get("CODER_API_KEY", "")
MAX_STEPS = int(os.environ.get("CODER_MAX_STEPS", "12"))
MAX_TOOL_CHARS = 4000

AUTO_YES = False
ARGS = [a for a in sys.argv[1:]]
if "--yes" in ARGS or "-y" in ARGS:
    AUTO_YES = True
    ARGS = [a for a in ARGS if a not in ("--yes", "-y")]

TOOLS_HELP = """Kullanabilecegin araclar (hepsi JSON ile cagrilir):
- list_dir   {"path": "."}                         dizin icerigini listeler
- read_file  {"path": "dosya", "start": 1, "end": 200}  satir araligi ile dosya okur
- write_file {"path": "dosya", "content": "..."}   dosyaya yazar (uzerine yazar)
- grep       {"pattern": "regex", "path": "."}      dosyalarda desen arar
- run_command{"command": "ls -la"}                  kabuk komutu calistirir"""

SYSTEM_PROMPT = """Sen terminalde calisan bir kodlama ajanisin. Kullanicinin bilgisayarindaki
dosyalari okuyup yazabilir, komut calistirabilirsin. Kisa ve net ol.

CALISMA BICIMI:
Bir araci kullanmak istedigin her turda SADECE su formatta tek bir JSON nesnesi yaz,
baska hicbir aciklama ekleme:

{{"action": "ARAC_ADI", "args": {{...}}}}

Ornek: {{"action": "read_file", "args": {{"path": "main.py"}}}}

Aracin sonucu sana "TOOL_RESULT" olarak geri gelir. Sonucu gordukten sonra ya bir arac
daha cagir ya da is bitince son cevabini su formatta ver:

{{"action": "final", "args": {{"text": "kullaniciya son cevabin"}}}}

Kurallar:
- Ayni anda sadece TEK JSON nesnesi yaz.
- Gereksiz yere dosya yazma veya komut calistirma.
- Emin degilsen once list_dir/read_file ile bak.
- Kullanici sadece soru soruyorsa dogrudan {{"action":"final", ...}} ile cevap ver.

{TOOLS}

Calisma dizini: {CWD}
Isletim sistemi: {OS}
"""


def log(msg):
    print(msg, flush=True)


def confirm(prompt):
    if AUTO_YES:
        return True
    try:
        return input(prompt + " [e/H] ").strip().lower() in ("e", "evet", "y", "yes")
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def truncate(text):
    text = "" if text is None else str(text)
    if len(text) > MAX_TOOL_CHARS:
        return text[:MAX_TOOL_CHARS] + f"\n... [kisaltildi, toplam {len(text)} karakter]"
    return text


def tool_list_dir(args):
    path = args.get("path", ".")
    p = Path(path)
    if not p.exists():
        return f"HATA: '{path}' yok."
    if p.is_file():
        return f"'{path}' bir dosya."
    out = []
    for entry in sorted(p.iterdir()):
        suffix = "/" if entry.is_dir() else ""
        out.append(entry.name + suffix)
    return "\n".join(out) if out else "(bos dizin)"


def tool_read_file(args):
    path = args.get("path")
    if not path:
        return "HATA: 'path' gerekli."
    p = Path(path)
    if not p.exists():
        return f"HATA: '{path}' yok."
    try:
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception as e:  # noqa: BLE001
        return f"HATA: okunamadi: {e}"
    start = int(args.get("start", 1) or 1)
    end = int(args.get("end", 0) or 0)
    if end <= 0 or end > len(lines):
        end = len(lines)
    start = max(1, start)
    chunk = lines[start - 1:end]
    numbered = [f"{start + i}: {line}" for i, line in enumerate(chunk)]
    header = f"# {path} (satir {start}-{end}/{len(lines)})\n"
    return truncate(header + "\n".join(numbered))


def tool_write_file(args):
    path = args.get("path")
    content = args.get("content", "")
    if not path:
        return "HATA: 'path' gerekli."
    p = Path(path)
    preview = content if len(content) < 600 else content[:600] + "\n..."
    log(f"\n--- YAZILACAK: {path} ---\n{preview}\n---")
    if not confirm(f"'{path}' dosyasina yazilsin mi?"):
        return "Kullanici yazmayi reddetti."
    p.parent.mkdir(parents=True, exist_ok=True)
    try:
        p.write_text(content, encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        return f"HATA: yazilamadi: {e}"
    return f"'{path}' yazildi ({len(content)} karakter)."


def tool_grep(args):
    pattern = args.get("pattern")
    path = args.get("path", ".")
    if not pattern:
        return "HATA: 'pattern' gerekli."
    rg = shutil_which("rg")
    try:
        if rg:
            cmd = [rg, "-n", "--no-heading", "-S", pattern, path]
        else:
            cmd = ["grep", "-rnE", pattern, path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        out = (res.stdout or res.stderr or "").strip()
        return truncate(out) if out else "(eslesme yok)"
    except Exception as e:  # noqa: BLE001
        return f"HATA: grep basarisiz: {e}"


def tool_run_command(args):
    command = args.get("command")
    if not command:
        return "HATA: 'command' gerekli."
    log(f"\n$ {command}")
    if not confirm("Komut calistirilsin mi?"):
        return "Kullanici komutu reddetti."
    try:
        res = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=120
        )
        out = []
        if res.stdout:
            out.append(res.stdout.rstrip())
        if res.stderr:
            out.append("[stderr]\n" + res.stderr.rstrip())
        out.append(f"[cikis kodu: {res.returncode}]")
        return truncate("\n".join(out))
    except subprocess.TimeoutExpired:
        return "HATA: komut zaman asimina ugradi (120 sn)."
    except Exception as e:  # noqa: BLE001
        return f"HATA: komut calistirilamadi: {e}"


def shutil_which(name):
    for d in os.environ.get("PATH", "").split(os.pathsep):
        cand = Path(d) / name
        if cand.is_file() and os.access(cand, os.X_OK):
            return str(cand)
    return None


TOOLS = {
    "list_dir": tool_list_dir,
    "read_file": tool_read_file,
    "write_file": tool_write_file,
    "grep": tool_grep,
    "run_command": tool_run_command,
}


def chat(messages):
    system = SYSTEM_PROMPT.format(TOOLS=TOOLS_HELP, CWD=os.getcwd(), OS=sys.platform)
    payload_msgs = [{"role": "system", "content": system}] + messages
    if PROVIDER == "openai":
        url = BASE_URL or "https://api.openai.com/v1/chat/completions"
        body = json.dumps({"model": MODEL, "messages": payload_msgs, "temperature": 0.2}).encode()
        headers = {"Content-Type": "application/json"}
        if API_KEY:
            headers["Authorization"] = f"Bearer {API_KEY}"
    else:
        base = BASE_URL or "http://localhost:11434"
        url = base.rstrip("/") + "/api/chat"
        body = json.dumps(
            {"model": MODEL, "messages": payload_msgs, "stream": False,
             "options": {"temperature": 0.2}}
        ).encode()
        headers = {"Content-Type": "application/json"}

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"API hatasi {e.code}: {detail[:500]}") from e
    except urllib.error.URLError as e:
        hint = ("Ollama calisiyor mu? 'ollama serve' ve 'ollama list' kontrol et."
                if PROVIDER == "ollama" else "BASE_URL/API_KEY dogru mu?")
        raise RuntimeError(f"Baglanti hatasi: {e.reason}. {hint}") from e

    if PROVIDER == "openai":
        return data["choices"][0]["message"]["content"] or ""
    return data.get("message", {}).get("content", "") or ""


def extract_action(text):
    """Metin icinden ilk 'action' iceren JSON nesnesini cikarir."""
    if not text:
        return None
    candidates = []
    for block in re.findall(r"```(?:json)?\s*(.*?)```", text, re.DOTALL):
        candidates.append(block)
    candidates.append(text)
    decoder = json.JSONDecoder()
    for cand in candidates:
        for i, ch in enumerate(cand):
            if ch != "{":
                continue
            try:
                obj, _ = decoder.raw_decode(cand[i:])
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and "action" in obj:
                return obj
    return None


def run_agent(messages, task):
    messages.append({"role": "user", "content": task})
    for step in range(1, MAX_STEPS + 1):
        try:
            reply = chat(messages)
        except RuntimeError as e:
            log(f"\n[!] {e}")
            return
        action = extract_action(reply)
        if action is None:
            log("\n" + reply.strip())
            messages.append({"role": "assistant", "content": reply})
            return

        name = action.get("action")
        args = action.get("args") or {}

        if name == "final":
            text = args.get("text", "") if isinstance(args, dict) else str(args)
            log("\n" + str(text).strip())
            messages.append({"role": "assistant", "content": str(text)})
            return

        fn = TOOLS.get(name)
        messages.append({"role": "assistant", "content": json.dumps(action)})
        if fn is None:
            result = f"HATA: bilinmeyen arac '{name}'. Gecerli: {', '.join(TOOLS)}"
        else:
            log(f"[adim {step}] {name} {json.dumps(args, ensure_ascii=False)[:160]}")
            try:
                result = fn(args if isinstance(args, dict) else {})
            except Exception as e:  # noqa: BLE001
                result = f"HATA: arac calisirken sorun: {e}"
        messages.append({"role": "user", "content": f"TOOL_RESULT ({name}):\n{result}"})
    log(f"\n[!] {MAX_STEPS} adim sinirina ulasildi, durduruldu.")


def banner():
    log("coder-cli  |  Claude Code benzeri yerel ajan")
    log(f"model: {MODEL}  |  saglayici: {PROVIDER}  |  dizin: {os.getcwd()}")
    log("komutlar: /help  /model <ad>  /cd <yol>  /reset  /exit")


def repl():
    messages = []
    banner()
    while True:
        try:
            line = input("\nsen> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not line:
            continue
        if line in ("/exit", "/quit", "/q"):
            break
        if line == "/help":
            log(TOOLS_HELP + "\n\nREPL: /model <ad>  /cd <yol>  /reset  /exit")
            continue
        if line == "/reset":
            messages = []
            log("konusma sifirlandi.")
            continue
        if line.startswith("/model"):
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                global MODEL
                MODEL = parts[1].strip()
                log(f"model = {MODEL}")
            else:
                log(f"model = {MODEL}")
            continue
        if line.startswith("/cd"):
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                try:
                    os.chdir(os.path.expanduser(parts[1].strip()))
                    log(f"dizin = {os.getcwd()}")
                except Exception as e:  # noqa: BLE001
                    log(f"cd hatasi: {e}")
            else:
                log(os.getcwd())
            continue
        run_agent(messages, line)


def main():
    if ARGS:
        run_agent([], " ".join(ARGS))
    else:
        repl()


if __name__ == "__main__":
    main()
