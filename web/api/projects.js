// Ortak calisma (co-work): projeler, davet, kabul, ortak sohbet. Yalnizca uyeler okur/yazar.
import {json} from "./_shared.js";
import {dbReady, redis, getJSON, setJSON} from "./_db.js";
import {currentUser, sameOrigin, randomToken, normEmail, validEmail} from "./_auth.js";

const MAX_MSGS = 400, MAX_BYTES = 800 * 1024;
const isMember = (p, u) => p && u && p.members.some(m => m.id === u.id);
const pub = p => ({id: p.id, name: p.name, owner: p.owner, ownerName: p.ownerName, members: p.members.map(m => ({name: m.name, email: m.email})), invites: p.invites || [], updated: p.updated || p.created});

export async function GET(req) {
  if (!dbReady) return json({projects: [], invites: []});
  const u = await currentUser(req); if (!u) return json({error: "Önce giriş yap."}, 401);
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const p = await getJSON("proj:" + id); if (!isMember(p, u)) return json({error: "Bu projeye erişimin yok."}, 403);
    return json({project: pub(p), messages: (await getJSON("pmsg:" + id)) || []});
  }
  const ids = (await redis("SMEMBERS", "uproj:" + u.id)) || [], inv = (await redis("SMEMBERS", "pinv:" + normEmail(u.email))) || [];
  const projects = [], invites = [];
  for (const x of ids) { const p = await getJSON("proj:" + x); if (isMember(p, u)) projects.push(pub(p)); }
  for (const x of inv) { const p = await getJSON("proj:" + x); if (p && (p.invites || []).includes(normEmail(u.email))) invites.push({id: p.id, name: p.name, from: p.ownerName}); }
  projects.sort((a, b) => b.updated - a.updated);
  return json({projects, invites});
}

export async function POST(req) {
  if (!dbReady) return json({error: "Hesap sistemi kapalı"}, 503);
  if (!sameOrigin(req)) return json({error: "Geçersiz istek"}, 403);
  const u = await currentUser(req); if (!u) return json({error: "Önce giriş yap."}, 401);
  const b = await req.json().catch(() => ({})), me = {id: u.id, name: u.name, email: normEmail(u.email)};
  if (b.action === "create") {
    const name = String(b.name || "").trim().slice(0, 60); if (!name) return json({error: "Proje adı yaz."}, 400);
    const p = {id: randomToken(9), name, owner: u.id, ownerName: u.name, members: [me], invites: [], created: Date.now(), updated: Date.now()};
    await setJSON("proj:" + p.id, p); await redis("SADD", "uproj:" + u.id, p.id);
    return json({project: pub(p)});
  }
  const p = await getJSON("proj:" + String(b.id || "")); if (!p) return json({error: "Proje bulunamadı."}, 404);
  if (b.action === "accept" || b.action === "decline") {
    if (!(p.invites || []).includes(me.email)) return json({error: "Davet bulunamadı."}, 404);
    p.invites = p.invites.filter(e => e !== me.email); await redis("SREM", "pinv:" + me.email, p.id);
    if (b.action === "accept" && !isMember(p, u)) { p.members.push(me); await redis("SADD", "uproj:" + u.id, p.id); }
    await setJSON("proj:" + p.id, p); return json({ok: true, project: pub(p)});
  }
  if (!isMember(p, u)) return json({error: "Bu projeye erişimin yok."}, 403);
  if (b.action === "invite") {
    const e = normEmail(b.email); if (!validEmail(e)) return json({error: "Geçerli bir e-posta yaz."}, 400);
    if (p.members.some(m => m.email === e)) return json({error: "Bu kişi zaten projede."}, 400);
    if ((p.invites || []).length >= 30) return json({error: "Çok fazla bekleyen davet var."}, 400);
    p.invites = [...new Set([...(p.invites || []), e])]; await redis("SADD", "pinv:" + e, p.id);
    await setJSON("proj:" + p.id, p); return json({ok: true, project: pub(p)});
  }
  if (b.action === "append") {
    const add = (Array.isArray(b.msgs) ? b.msgs : []).slice(0, 20).map(m => ({role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 60000), by: m.role === "assistant" ? "" : u.name, at: Date.now()}));
    let list = ((await getJSON("pmsg:" + p.id)) || []).concat(add).slice(-MAX_MSGS);
    while (JSON.stringify(list).length > MAX_BYTES && list.length > 10) list = list.slice(5);
    await setJSON("pmsg:" + p.id, list); p.updated = Date.now(); await setJSON("proj:" + p.id, p);
    return json({ok: true, count: list.length});
  }
  if (b.action === "leave") {
    if (p.owner === u.id) { // sahip ayrilirsa proje silinir
      for (const m of p.members) await redis("SREM", "uproj:" + m.id, p.id);
      for (const e of p.invites || []) await redis("SREM", "pinv:" + e, p.id);
      await redis("DEL", "proj:" + p.id); await redis("DEL", "pmsg:" + p.id); return json({ok: true, deleted: true});
    }
    p.members = p.members.filter(m => m.id !== u.id); await redis("SREM", "uproj:" + u.id, p.id);
    await setJSON("proj:" + p.id, p); return json({ok: true});
  }
  return json({error: "Bilinmeyen işlem"}, 400);
}
