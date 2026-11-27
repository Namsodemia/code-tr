// Ogrenen Code-Tr: kullanicilar cevaplari degerlendirir ve dogrusunu ogretir; yonetici onaylar;
// onaylanan bilgiler "topluluk hafizasi" olarak benzer sorularda modele verilir. Hepsi kendi veritabanimizda.
import {json, limited} from "./_shared.js";
import {dbReady, redis, getJSON} from "./_db.js";
import {currentUser, sameOrigin, randomToken, isAdmin} from "./_auth.js";

const STOP = new Set("ve veya ile için gibi bir bu şu o da de mi mı mu mü ne nasıl neden niye nedir kaç hangi çok daha en ama ise ki ya yani olan olarak var yok her hiç sen ben biz siz onlar bana sana beni seni lütfen merhaba selam nin nın nun nün the a an of to in is are what how why".split(" "));
export function keywords(text) {
  return [...new Set(String(text || "").toLocaleLowerCase("tr").normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w))
    .map(w => w.slice(0, 6)))];          // kaba kok: Turkce ekleri yumusatmak icin ilk 6 harf
}

let kbCache = null, kbAt = 0;
async function loadKB() {
  if (kbCache && Date.now() - kbAt < 60000) return kbCache;
  const h = await redis("HGETALL", "learn:kb") || [];
  const list = [];
  for (let i = 0; i < h.length; i += 2) { try { list.push(JSON.parse(h[i + 1])); } catch {} }
  kbCache = list; kbAt = Date.now();
  return list;
}
// Kalici kurallar: yoneticinin yazdigi, her cevapta gecerli talimatlar (ton, TDK, Code-Tr kimligi vb.)
let rulesCache = null, rulesAt = 0;
export async function loadRules() {
  if (rulesCache && Date.now() - rulesAt < 60000) return rulesCache;
  const h = await redis("HGETALL", "learn:rules") || [];
  const list = [];
  for (let i = 0; i < h.length; i += 2) { try { list.push(JSON.parse(h[i + 1])); } catch {} }
  rulesCache = list.sort((a, b) => a.t - b.t); rulesAt = Date.now();
  return rulesCache;
}
export async function searchKB(q, n = 4) {
  const qk = keywords(q);
  if (!qk.length) return [];
  const scored = (await loadKB()).map(e => {
    const ek = e.k || keywords(e.q + " " + e.a);
    const hit = qk.filter(w => ek.includes(w)).length;
    const titleHit = qk.filter(w => keywords(e.q).includes(w)).length;
    return {e, hit, score: (hit + titleHit * 0.5) / Math.max(2, Math.min(qk.length, 8))};
  }).filter(x => x.hit >= Math.min(2, qk.length) && x.score >= 0.34)
    .sort((a, b) => b.score - a.score).slice(0, n);
  return scored.map(x => ({q: x.e.q, a: x.e.a, src: x.e.src || ""}));
}

// Metni ~900 karakterlik, cumle sinirinda bolunmus parcalara ayir.
function chunks(text, size = 900) {
  const sents = String(text).replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  const out = []; let cur = "";
  for (const s of sents) {
    if ((cur + " " + s).length > size && cur) { out.push(cur.trim()); cur = ""; }
    cur += " " + s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(c => c.length > 40).slice(0, 120);
}
function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").replace(/(\.\s*){2,}/g, ". ").trim();
}
// Yalnizca herkese acik http(s) adresleri (yerel ag / sunucu ici adresler engellenir).
function safeUrl(u) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return null;
    const h = x.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/.test(h)) return null;
    return x.toString();
  } catch { return null; }
}
async function storeDoc(title, text, src) {
  const parts = chunks(text);
  const sid = randomToken(8);
  for (let i = 0; i < parts.length; i++) {
    const id = sid + "-" + i;
    await redis("HSET", "learn:kb", id, JSON.stringify({id, sid, q: title, a: parts[i], src, k: keywords(title + " " + parts[i]), t: Date.now()}));
  }
  await redis("HSET", "learn:sources", sid, JSON.stringify({sid, title, src, parts: parts.length, chars: text.length, t: Date.now()}));
  kbCache = null;
  return {sid, parts: parts.length};
}

export async function GET(req) {
  if (!dbReady) return json({notes: []});
  const url = new URL(req.url), action = url.searchParams.get("action");
  if (action === "search") {
    const q = (url.searchParams.get("q") || "").slice(0, 500);
    const [notes, rules] = await Promise.all([searchKB(q).catch(() => []), loadRules().catch(() => [])]);
    return json({notes, rules: rules.map(r => r.text)});
  }
  const user = await currentUser(req);
  if (!isAdmin(user)) return json({error: "Yetkin yok."}, 403);
  if (action === "pending") {
    const items = (await redis("LRANGE", "learn:pending", 0, 99) || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
    const [kb, up, down] = await Promise.all([redis("HLEN", "learn:kb"), redis("GET", "learn:votes:up"), redis("GET", "learn:votes:down")]);
    const recent = (await redis("LRANGE", "learn:feedback", 0, 29) || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
    return json({items, stats: {kb: Number(kb) || 0, up: Number(up) || 0, down: Number(down) || 0}, recent});
  }
  if (action === "kb") return json({items: (await loadKB()).filter(e => !e.sid)});
  if (action === "rules") return json({items: await loadRules()});
  if (action === "sources") {
    const h = await redis("HGETALL", "learn:sources") || [];
    const list = [];
    for (let i = 0; i < h.length; i += 2) { try { list.push(JSON.parse(h[i + 1])); } catch {} }
    return json({items: list.sort((a, b) => b.t - a.t)});
  }
  if (action === "export") {
    // Hugging Face veri seti icin JSONL (soru-cevap ve belge parcalari)
    const lines = (await loadKB()).map(e => JSON.stringify({instruction: e.q, output: e.a, source: e.src || "topluluk"})).join("\n");
    return new Response(lines + "\n", {headers: {"Content-Type": "application/jsonl; charset=utf-8", "Content-Disposition": "attachment; filename=code-tr-veri.jsonl", "Cache-Control": "no-store"}});
  }
  return json({error: "Bilinmeyen işlem"}, 400);
}

export async function POST(req) {
  if (!dbReady) return json({error: "Öğrenme sistemi kapalı."}, 503);
  if (!sameOrigin(req)) return json({error: "Geçersiz istek"}, 403);
  const user = await currentUser(req);
  if (!user) return json({error: "Önce giriş yap."}, 401);
  let b; try { b = await req.json(); } catch { return json({error: "Geçersiz istek"}, 400); }
  const action = new URL(req.url).searchParams.get("action");
  const clip = (s, n) => String(s || "").trim().slice(0, n);

  if (action === "vote") {
    if (limited(req, 120)) return json({error: "Çok hızlı."}, 429);
    const up = b.vote === 1;
    await redis("INCR", up ? "learn:votes:up" : "learn:votes:down");
    if (!up) {
      await redis("LPUSH", "learn:feedback", JSON.stringify({t: Date.now(), q: clip(b.q, 600), a: clip(b.a, 1500), model: clip(b.model, 80)}));
      await redis("LTRIM", "learn:feedback", 0, 499);
    }
    return json({ok: true});
  }

  if (action === "teach") {
    if (limited(req, 20, 60 * 60 * 1000)) return json({error: "Bir saatte çok fazla katkı gönderdin, sonra tekrar dene."}, 429);
    const q = clip(b.q, 600), a = clip(b.a, 3000);
    if (q.length < 3 || a.length < 5) return json({error: "Soru ve doğru cevap boş olmasın."}, 400);
    const item = {id: randomToken(8), t: Date.now(), q, a, by: user.id, name: user.name};
    if (isAdmin(user)) {   // yonetici ogrettiyse onay beklemeden hafizaya girer
      await redis("HSET", "learn:kb", item.id, JSON.stringify({id: item.id, q, a, k: keywords(q), t: Date.now()}));
      kbCache = null;
      return json({ok: true, direct: true});
    }
    await redis("LPUSH", "learn:pending", JSON.stringify(item));
    await redis("LTRIM", "learn:pending", 0, 499);
    return json({ok: true});
  }

  if (!isAdmin(user)) return json({error: "Yetkin yok."}, 403);
  if (action === "approve" || action === "reject") {
    const items = await redis("LRANGE", "learn:pending", 0, 499) || [];
    const raw = items.find(x => { try { return JSON.parse(x).id === b.id; } catch { return false; } });
    if (!raw) return json({error: "Bulunamadı"}, 404);
    await redis("LREM", "learn:pending", 1, raw);
    if (action === "approve") {
      const it = JSON.parse(raw);
      const q = clip(b.q || it.q, 600), a = clip(b.a || it.a, 3000);
      await redis("HSET", "learn:kb", it.id, JSON.stringify({id: it.id, q, a, k: keywords(q), t: Date.now()}));
      kbCache = null;
    }
    return json({ok: true});
  }
  if (action === "add_text") {
    const title = clip(b.title, 200) || clip(b.text, 80);
    const text = clip(b.text, 200000);
    if (text.length < 10) return json({error: "En az bir cümle yaz."}, 400);
    return json({ok: true, ...(await storeDoc(title, text, ""))});
  }
  if (action === "add_url") {
    const url = safeUrl(clip(b.url, 2000));
    if (!url) return json({error: "Geçerli, herkese açık bir http(s) bağlantısı yaz."}, 400);
    let res;
    try { res = await fetch(url, {redirect: "follow", headers: {"User-Agent": "Code-Tr-Ogrenici/1.0 (+https://coder-tr.vercel.app)"}, signal: AbortSignal.timeout(15000)}); }
    catch { return json({error: "Sayfa açılamadı."}, 502); }
    if (!res.ok) return json({error: "Sayfa açılamadı (" + res.status + ")."}, 502);
    const type = res.headers.get("content-type") || "";
    if (!/text\/|html|json|xml/.test(type)) return json({error: "Bu bağlantı bir web sayfası değil (" + type.split(";")[0] + "). PDF'leri metin olarak yapıştırabilirsin."}, 400);
    const raw = (await res.text()).slice(0, 2000000);
    const title = clip(b.title, 200) || clip((raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 200).replace(/\s+/g, " ") || url;
    const text = /html/.test(type) ? htmlToText(raw) : raw;
    if (text.length < 50) return json({error: "Sayfada okunabilir metin bulunamadı."}, 400);
    return json({ok: true, title, ...(await storeDoc(title, text.slice(0, 200000), url))});
  }
  if (action === "remove_source") {
    const sid = clip(b.sid, 40);
    const all = await loadKB();
    const ids = all.filter(e => e.sid === sid).map(e => e.id);
    if (ids.length) await redis("HDEL", "learn:kb", ...ids);
    await redis("HDEL", "learn:sources", sid); kbCache = null;
    return json({ok: true, removed: ids.length});
  }
  if (action === "add_rule") {
    const text = clip(b.text, 500);
    if (text.length < 5) return json({error: "Kural en az birkaç kelime olsun."}, 400);
    if ((await loadRules()).length >= 40) return json({error: "En fazla 40 kural olabilir; önce birini sil."}, 400);
    const id = randomToken(8);
    await redis("HSET", "learn:rules", id, JSON.stringify({id, text, t: Date.now()}));
    rulesCache = null;
    return json({ok: true, id});
  }
  if (action === "remove_rule") {
    await redis("HDEL", "learn:rules", clip(b.id, 40)); rulesCache = null;
    return json({ok: true});
  }
  if (action === "forget") {
    await redis("HDEL", "learn:kb", clip(b.id, 40)); kbCache = null;
    return json({ok: true});
  }
  return json({error: "Bilinmeyen işlem"}, 400);
}
