// Iletisim formu: mesajlar veritabaninda "contact" listesine kaydedilir (e-posta adresi gostermeye gerek kalmaz).
import {json, limited} from "./_shared.js";
import {dbReady, redis} from "./_db.js";
import {sameOrigin} from "./_auth.js";

export async function POST(req) {
  if (!dbReady) return json({error: "İletişim formu şu an kapalı."}, 503);
  if (!sameOrigin(req)) return json({error: "Geçersiz istek"}, 403);
  if (limited(req, 5, 60 * 60 * 1000)) return json({error: "Çok fazla mesaj gönderdin, daha sonra tekrar dene."}, 429);
  let b; try { b = await req.json(); } catch { return json({error: "Geçersiz istek"}, 400); }
  const msg = String(b.message || "").trim(), email = String(b.email || "").trim().slice(0, 200);
  if (b.website) return json({ok: true});            // bot tuzagi
  if (msg.length < 5 || msg.length > 5000) return json({error: "Mesajın 5 ile 5000 karakter arasında olmalı."}, 400);
  await redis("LPUSH", "contact", JSON.stringify({t: Date.now(), topic: String(b.topic || "genel").slice(0, 40), email, msg}));
  await redis("LTRIM", "contact", 0, 999);
  return json({ok: true});
}
