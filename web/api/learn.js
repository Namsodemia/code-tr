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
export async function searchKB(q, n = 3) {
  const qk = keywords(q);
  if (!qk.length) return [];
  const scored = (await loadKB()).map(e => {
    const ek = e.k || keywords(e.q);
    const hit = qk.filter(w => ek.includes(w)).length;
    return {e, score: hit / Math.max(3, Math.min(qk.length, ek.length))};
  }).filter(x => x.score >= 0.34).sort((a, b) => b.score - a.score).slice(0, n);
  return scored.map(x => ({q: x.e.q, a: x.e.a}));
}

export async function GET(req) {
  if (!dbReady) return json({notes: []});
  const url = new URL(req.url), action = url.searchParams.get("action");
  if (action === "search") {
    const q = (url.searchParams.get("q") || "").slice(0, 500);
    try { return json({notes: await searchKB(q)}); } catch { return json({notes: []}); }
  }
  const user = await currentUser(req);
  if (!isAdmin(user)) return json({error: "Yetkin yok."}, 403);
  if (action === "pending") {
    const items = (await redis("LRANGE", "learn:pending", 0, 99) || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
    const [kb, up, down] = await Promise.all([redis("HLEN", "learn:kb"), redis("GET", "learn:votes:up"), redis("GET", "learn:votes:down")]);
    const recent = (await redis("LRANGE", "learn:feedback", 0, 29) || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
    return json({items, stats: {kb: Number(kb) || 0, up: Number(up) || 0, down: Number(down) || 0}, recent});
  }
  if (action === "kb") return json({items: await loadKB()});
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
  if (action === "forget") {
    await redis("HDEL", "learn:kb", clip(b.id, 40)); kbCache = null;
    return json({ok: true});
  }
  return json({error: "Bilinmeyen işlem"}, 400);
}
