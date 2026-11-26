// Ortak yardimcilar: paylasilan OpenRouter anahtari yalnizca sunucuda kalir.
export const BASE = "https://openrouter.ai/api/v1";
export const KEY = process.env.OPENROUTER_API_KEY || "";

// Basit, en iyi gayret kisi basi sinir (ayni sunucu ornegi icinde).
const hits = new Map();
export function limited(req, max = 40, windowMs = 10 * 60 * 1000) {
  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {status, headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"}});
