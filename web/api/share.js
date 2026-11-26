// Musteriye link: IDE'deki proje coder-tr.vercel.app/p/<kimlik>/ adresinde yayinlanir.
// Yalniz giris yapmis kullanici yukler/gunceller/siler; link herkese aciktir (bilen gorur), Google'a kapali.
// Dosyalar Redis'te surumlu anahtarlarda durur: guncelleme bitene kadar eski surum yayinda kalir.
import {json} from "./_shared.js";
import {dbReady, redis, getJSON, setJSON} from "./_db.js";
import {currentUser, sameOrigin, randomToken} from "./_auth.js";

const MAX_FILE = 600 * 1024, MAX_TOTAL = 8 * 1024 * 1024, MAX_FILES = 300, MAX_SHARES = 30;
const okPath = p => typeof p === "string" && p.length > 0 && p.length < 300 && !p.startsWith("/") &&
  !p.split("/").some(s => !s || s === "." || s === ".." || s.startsWith(".env")) && !/[\\\0]/.test(p);
const fkey = (id, ver, p) => "sf:" + id + ":" + ver + ":" + p;
const pub = (s, origin) => ({id: s.id, name: s.name, url: origin + "/p/" + s.id + "/", files: (s.files || []).length, updated: s.updated});

export async function GET(req) {
  if (!dbReady) return json({shares: []});
  const u = await currentUser(req); if (!u) return json({error: "Önce giriş yap."}, 401);
  const origin = new URL(req.url).origin, ids = (await redis("SMEMBERS", "ushare:" + u.id)) || [], shares = [];
  for (const id of ids) { const s = await getJSON("share:" + id); if (s && s.owner === u.id) shares.push(pub(s, origin)); }
  shares.sort((a, b) => b.updated - a.updated);
  return json({shares});
}

export async function POST(req) {
  if (!dbReady) return json({error: "Link paylaşımı şu an kapalı."}, 503);
  if (!sameOrigin(req)) return json({error: "Geçersiz istek"}, 403);
  const u = await currentUser(req); if (!u) return json({error: "Link oluşturmak için giriş yap."}, 401);
  const b = await req.json().catch(() => ({})), origin = new URL(req.url).origin;

  if (b.action === "start") {
    let s = b.id ? await getJSON("share:" + String(b.id)) : null;
    if (s && s.owner !== u.id) s = null;
    if (!s) {
      if (((await redis("SCARD", "ushare:" + u.id)) || 0) >= MAX_SHARES) return json({error: "En fazla " + MAX_SHARES + " link açabilirsin; eskilerden birini sil."}, 400);
      s = {id: randomToken(6), owner: u.id, name: "", ver: 0, files: [], created: Date.now(), updated: Date.now()};
      await redis("SADD", "ushare:" + u.id, s.id);
    }
    s.name = String(b.name || s.name || "Proje").trim().slice(0, 80);
    s.next = (s.ver || 0) + 1; s.pending = 0;
    await setJSON("share:" + s.id, s);
    return json({id: s.id, ver: s.next, url: origin + "/p/" + s.id + "/"});
  }

  const s = await getJSON("share:" + String(b.id || ""));
  if (!s || s.owner !== u.id) return json({error: "Link bulunamadı."}, 404);

  if (b.action === "file") {
    if (b.ver !== s.next || !okPath(b.path)) return json({error: "Geçersiz dosya."}, 400);
    const data = String(b.data || ""); const size = Math.floor(data.length * 3 / 4);
    if (size > MAX_FILE) return json({error: b.path + " çok büyük (en fazla 600 KB)."}, 400);
    if ((s.pending || 0) + size > MAX_TOTAL) return json({error: "Proje 8 MB'tan büyük; büyük görsel/videoları küçült ya da çıkar."}, 400);
    await redis("SET", fkey(s.id, s.next, b.path), data, "EX", 3600);   // tamamlanmazsa kendiliginden silinir
    s.pending = (s.pending || 0) + size; await setJSON("share:" + s.id, s);
    return json({ok: true});
  }

  if (b.action === "commit") {
    const files = (Array.isArray(b.files) ? b.files : []).filter(f => f && okPath(f.path)).slice(0, MAX_FILES)
      .map(f => ({path: f.path, type: String(f.type || "application/octet-stream").slice(0, 100)}));
    if (b.ver !== s.next || !files.length) return json({error: "Yükleme tamamlanamadı, tekrar dene."}, 400);
    for (const f of files) await redis("PERSIST", fkey(s.id, s.next, f.path));
    const old = s.files || [], oldVer = s.ver;
    s.ver = s.next; s.files = files; s.updated = Date.now(); delete s.next; delete s.pending;
    await setJSON("share:" + s.id, s);
    if (oldVer && old.length) await redis("DEL", ...old.map(f => fkey(s.id, oldVer, f.path)));
    return json({ok: true, share: pub(s, origin)});
  }

  if (b.action === "delete") {
    if (s.ver && (s.files || []).length) await redis("DEL", ...s.files.map(f => fkey(s.id, s.ver, f.path)));
    await redis("DEL", "share:" + s.id); await redis("SREM", "ushare:" + u.id, s.id);
    return json({ok: true});
  }
  return json({error: "Bilinmeyen işlem"}, 400);
}
