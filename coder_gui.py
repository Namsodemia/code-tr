#!/usr/bin/env python3
"""Coder — Mac icin tiklanabilir masaustu AI ajan uygulamasi.

Yerel Ollama modeline baglanir. Sohbet eder, dosya okur/yazar,
komut calistirir. Saf Python + tkinter; ek kurulum gerekmez.

Calistir:  python3 coder_gui.py
"""
import os
import queue
import threading
import tkinter as tk
import urllib.request
from tkinter import filedialog, messagebox, scrolledtext, ttk

import coder

OLLAMA = os.environ.get("CODER_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("CODER_MODEL", "qwen2.5-coder:3b")
MAX_STEPS = int(os.environ.get("CODER_MAX_STEPS", "10"))

# Koyu tema renkleri
BG = "#0f1115"
BG2 = "#161a21"
FG = "#e6e6e6"
MUTED = "#8b93a1"
ACCENT = "#4f8cff"
ACCENT_HI = "#6aa0ff"
USER_C = "#7ee0a0"
BOT_C = "#d7dae0"
TOOL_C = "#f0b46b"
ERR_C = "#ff6b6b"

coder.AUTO_YES = True  # onaylari GUI tarafinda soruyoruz


def list_models():
    try:
        with urllib.request.urlopen(f"{OLLAMA}/api/tags", timeout=3) as r:
            import json
            data = json.loads(r.read().decode())
        names = [m["name"] for m in data.get("models", [])]
        return names or [DEFAULT_MODEL]
    except Exception:  # noqa: BLE001
        return [DEFAULT_MODEL]


class App:
    def __init__(self, root):
        self.root = root
        self.ui = queue.Queue()
        self.busy = False
        self.history = []
        self.cwd = os.path.expanduser("~")
        os.chdir(self.cwd)

        root.title("Coder")
        root.geometry("880x640")
        root.minsize(640, 460)
        root.configure(bg=BG)

        self._build_ui()
        self._pump()
        self._welcome()

    # ---------- arayuz ----------
    def _build_ui(self):
        header = tk.Frame(self.root, bg=BG2, height=56)
        header.pack(fill="x", side="top")
        header.pack_propagate(False)

        tk.Label(header, text="Coder", bg=BG2, fg=FG,
                 font=("Helvetica Neue", 18, "bold")).pack(side="left", padx=(16, 10))

        self.model_var = tk.StringVar(value=DEFAULT_MODEL)
        models = list_models()
        if DEFAULT_MODEL not in models:
            models.insert(0, DEFAULT_MODEL)
        self.model_box = ttk.Combobox(header, textvariable=self.model_var,
                                      values=models, width=22, state="readonly")
        self.model_box.pack(side="left", padx=6, pady=14)

        self.folder_btn = tk.Button(header, text="Klasör", command=self.pick_folder,
                                    bg=BG2, fg=ACCENT, activebackground=BG2,
                                    activeforeground=ACCENT_HI, bd=0,
                                    font=("Helvetica Neue", 12))
        self.folder_btn.pack(side="right", padx=(4, 14))

        self.cwd_label = tk.Label(header, text=self._short(self.cwd), bg=BG2,
                                  fg=MUTED, font=("Helvetica Neue", 11))
        self.cwd_label.pack(side="right", padx=4)

        self.chat = scrolledtext.ScrolledText(
            self.root, wrap="word", bg=BG, fg=FG, bd=0, padx=16, pady=12,
            font=("Menlo", 12), insertbackground=FG, state="disabled",
            highlightthickness=0)
        self.chat.pack(fill="both", expand=True)
        self.chat.tag_config("user", foreground=USER_C, font=("Menlo", 12, "bold"))
        self.chat.tag_config("bot", foreground=BOT_C, font=("Menlo", 12))
        self.chat.tag_config("tool", foreground=TOOL_C, font=("Menlo", 11, "italic"))
        self.chat.tag_config("err", foreground=ERR_C, font=("Menlo", 11))
        self.chat.tag_config("muted", foreground=MUTED, font=("Menlo", 10))

        bottom = tk.Frame(self.root, bg=BG2)
        bottom.pack(fill="x", side="bottom")
        self.input = tk.Text(bottom, height=3, bg=BG2, fg=FG, bd=0,
                             padx=12, pady=10, insertbackground=FG,
                             font=("Menlo", 12), wrap="word", highlightthickness=0)
        self.input.pack(side="left", fill="both", expand=True, padx=(10, 6), pady=10)
        self.input.bind("<Return>", self._on_enter)
        self.input.bind("<Shift-Return>", lambda e: None)

        self.send_btn = tk.Button(bottom, text="Gönder", command=self.send,
                                  bg=ACCENT, fg="white", activebackground=ACCENT_HI,
                                  activeforeground="white", bd=0, padx=18, pady=8,
                                  font=("Helvetica Neue", 12, "bold"))
        self.send_btn.pack(side="right", padx=(0, 12), pady=10)

        self.status = tk.Label(self.root, text="hazır", bg=BG2, fg=MUTED,
                               anchor="w", font=("Helvetica Neue", 10), padx=12)
        self.status.pack(fill="x", side="bottom")

        self.input.focus_set()

    def _short(self, p):
        home = os.path.expanduser("~")
        return "~" + p[len(home):] if p.startswith(home) else p

    def _welcome(self):
        self._append("Coder", "Merhaba! Yerel modelle çalışan ajanın hazır.\n"
                     "Dosya okuyup yazabilir, komut çalıştırabilir, sorularını yanıtlar.\n"
                     "Modeli üstteki menüden, çalışma klasörünü sağdaki 'Klasör' ile seç.",
                     "bot")

    # ---------- yardimcilar ----------
    def _append(self, who, text, tag):
        self.chat.configure(state="normal")
        self.chat.insert("end", f"\n{who}\n", tag)
        self.chat.insert("end", text + "\n", tag if tag != "user" else "bot")
        self.chat.see("end")
        self.chat.configure(state="disabled")

    def _set_status(self, text):
        self.status.configure(text=text)

    def _pump(self):
        try:
            while True:
                msg = self.ui.get_nowait()
                kind = msg[0]
                if kind == "append":
                    self._append(msg[1], msg[2], msg[3])
                elif kind == "status":
                    self._set_status(msg[1])
                elif kind == "done":
                    self.busy = False
                    self.send_btn.configure(state="normal", text="Gönder")
                    self._set_status("hazır")
                elif kind == "confirm":
                    prompt, event, box = msg[1], msg[2], msg[3]
                    box["ok"] = messagebox.askyesno("Onay", prompt, parent=self.root)
                    event.set()
        except queue.Empty:
            pass
        self.root.after(60, self._pump)

    def pick_folder(self):
        d = filedialog.askdirectory(initialdir=self.cwd, parent=self.root)
        if d:
            self.cwd = d
            os.chdir(d)
            self.cwd_label.configure(text=self._short(d))
            self._append("Sistem", f"Çalışma klasörü: {d}", "muted")

    # ---------- giris ----------
    def _on_enter(self, event):
        if event.state & 0x1:  # shift basili -> yeni satir
            return None
        self.send()
        return "break"

    def send(self):
        if self.busy:
            return
        text = self.input.get("1.0", "end").strip()
        if not text:
            return
        self.input.delete("1.0", "end")
        self._append("Sen", text, "user")
        self.busy = True
        self.send_btn.configure(state="disabled", text="...")
        self._set_status("düşünüyor...")
        threading.Thread(target=self._agent, args=(text,), daemon=True).start()

    # ---------- onay (worker -> UI) ----------
    def _ask(self, prompt):
        event = threading.Event()
        box = {"ok": False}
        self.ui.put(("confirm", prompt, event, box))
        event.wait()
        return box["ok"]

    # ---------- ajan ----------
    def _agent(self, task):
        coder.MODEL = self.model_var.get()
        coder.PROVIDER = "ollama"
        self.history.append({"role": "user", "content": task})
        for step in range(1, MAX_STEPS + 1):
            try:
                reply = coder.chat(self.history)
            except Exception as e:  # noqa: BLE001
                self.ui.put(("append", "Hata", str(e), "err"))
                break
            action = coder.extract_action(reply)
            if action is None:
                self.ui.put(("append", "Coder", reply.strip() or "(boş yanıt)", "bot"))
                self.history.append({"role": "assistant", "content": reply})
                break

            name = action.get("action")
            args = action.get("args") or {}

            if name == "final":
                text = args.get("text", "") if isinstance(args, dict) else str(args)
                self.ui.put(("append", "Coder", str(text).strip(), "bot"))
                self.history.append({"role": "assistant", "content": str(text)})
                break

            fn = coder.TOOLS.get(name)
            self.ui.put(("status", f"adım {step}: {name}"))
            self.ui.put(("append", "· araç",
                         f"{name} {str(args)[:200]}", "tool"))
            self.history.append({"role": "assistant", "content": json_dumps(action)})

            if fn is None:
                result = f"HATA: bilinmeyen araç '{name}'"
            else:
                if name == "write_file" and not self._ask(
                        f"'{args.get('path')}' dosyasına yazılsın mı?"):
                    result = "Kullanıcı reddetti."
                elif name == "run_command" and not self._ask(
                        f"Komut çalıştırılsın mı?\n\n{args.get('command')}"):
                    result = "Kullanıcı reddetti."
                else:
                    try:
                        result = fn(args if isinstance(args, dict) else {})
                    except Exception as e:  # noqa: BLE001
                        result = f"HATA: {e}"
            self.history.append({"role": "user",
                                 "content": f"TOOL_RESULT ({name}):\n{result}"})
        else:
            self.ui.put(("append", "Sistem", f"{MAX_STEPS} adım sınırına ulaşıldı.", "muted"))
        self.ui.put(("done",))


def json_dumps(o):
    import json
    return json.dumps(o, ensure_ascii=False)


def main():
    root = tk.Tk()
    app = App(root)
    if os.environ.get("CODER_GUI_SELFTEST"):
        root.after(1200, root.destroy)
    root.mainloop()


if __name__ == "__main__":
    main()
