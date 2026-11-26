import {redis, getJSON, setJSON} from "./_db.js";

const SESSION_DAYS = 30;
const enc = new TextEncoder();
const b64 = buf => Buffer.from(buf).toString("base64url");

export const randomToken = (n = 32) => b64(crypto.getRandomValues(new Uint8Array(n)));

export async function hashPassword(password, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 210000}, key, 256);
  return {salt, hash: b64(bits)};
}
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const normEmail = e => String(e || "").trim().toLowerCase();
export const validEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(e);

export async function getUserByEmail(email) {
  const id = await redis("GET", "email:" + normEmail(email));
  return id ? getJSON("user:" + id) : null;
}
export async function createUser({email, name, password, google}) {
  const id = randomToken(12);
  const user = {id, email: normEmail(email), name: String(name || "").trim().slice(0, 60) || normEmail(email).split("@")[0],
                created: Date.now(), terms: Date.now()};
  if (password) Object.assign(user, await hashPassword(password));
  if (google) user.google = google;
  const ok = await redis("SET", "email:" + user.email, id, "NX");
  if (ok !== "OK") return null;
  await setJSON("user:" + id, user);
  return user;
}
const ADMINS = (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
export const isAdmin = u => Boolean(u && ADMINS.includes(String(u.email).toLowerCase()));
export const publicUser = u => u && {id: u.id, email: u.email, name: u.name, google: Boolean(u.google), hasPassword: Boolean(u.hash), admin: isAdmin(u)};

export async function newSession(userId) {
  const tok = randomToken(32);
  await redis("SET", "sess:" + tok, userId, "EX", SESSION_DAYS * 86400);
  return tok;
}
export function sessionCookie(tok, maxAge = SESSION_DAYS * 86400) {
  return `coder_sess=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function readCookie(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : "";
}
export async function currentUser(req) {
  const tok = readCookie(req, "coder_sess");
  if (!tok || tok.length > 100) return null;
  const id = await redis("GET", "sess:" + tok);
  return id ? getJSON("user:" + id) : null;
}
// Ayni siteden gelmeyen POST isteklerini reddet (CSRF korumasi).
export function sameOrigin(req) {
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === new URL(req.url).host; } catch { return false; }
}
// Hesap basina yanlis sifre siniri
export async function tooManyAttempts(key, max = 8, windowSec = 900) {
  const n = await redis("INCR", "tries:" + key);
  if (n === 1) await redis("EXPIRE", "tries:" + key, windowSec);
  return n > max;
}
