// Glow Up ekibi: yalnizca yoneticinin ekledigi e-postalar Glow Up sekmesini gorur.
import {json} from "./_shared.js";
import {dbReady, redis} from "./_db.js";
import {currentUser, sameOrigin, isAdmin, normEmail, validEmail} from "./_auth.js";

async function brands() {
  try { return (await import("./_glowup_brands.js")).BRANDS; } catch { return []; }
}
export async function isMember(u) {
  if (!u) return false;
  if (isAdmin(u)) return true;
  return (await redis("SISMEMBER", "team:glowup", normEmail(u.email))) === 1;
}
export async function GET(req) {
  if (!dbReady()) return json({member: false});
  const u = await currentUser(req);
  if (!(await isMember(u))) return json({member: false});
  const out = {member: true, brands: await brands()};
  if (isAdmin(u)) out.members = (await redis("SMEMBERS", "team:glowup")) || [];
  return json(out);
}
export async function POST(req) {
  if (!sameOrigin(req)) return json({error: "Geçersiz istek."}, 403);
  const u = await currentUser(req);
  if (!isAdmin(u)) return json({error: "Yalnızca yönetici."}, 403);
  const {action, email} = await req.json().catch(() => ({}));
  const e = normEmail(email);
  if (!validEmail(e)) return json({error: "Geçerli bir e-posta yaz."}, 400);
  await redis(action === "remove" ? "SREM" : "SADD", "team:glowup", e);
  return json({ok: true, members: (await redis("SMEMBERS", "team:glowup")) || []});
}
