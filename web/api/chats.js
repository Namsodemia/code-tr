import {json} from "./_shared.js";
import {dbReady, getJSON, setJSON} from "./_db.js";
import {currentUser, sameOrigin} from "./_auth.js";

const MAX_BYTES = 900 * 1024;

export async function GET(req) {
  if (!dbReady) return json({chats: []});
  const user = await currentUser(req);
  if (!user) return json({error: "Önce giriş yap."}, 401);
  return json({chats: (await getJSON("chats:" + user.id)) || []});
}

export async function PUT(req) {
  if (!dbReady) return json({error: "Hesap sistemi kapalı"}, 503);
  if (!sameOrigin(req)) return json({error: "Geçersiz istek"}, 403);
  const user = await currentUser(req);
  if (!user) return json({error: "Önce giriş yap."}, 401);
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({error: "Sohbet geçmişi çok büyük; eski sohbetlerden bazılarını sil."}, 413);
  let chats; try { chats = JSON.parse(text).chats; } catch { return json({error: "Geçersiz veri"}, 400); }
  if (!Array.isArray(chats)) return json({error: "Geçersiz veri"}, 400);
  await setJSON("chats:" + user.id, chats.slice(0, 200));
  return json({ok: true});
}
