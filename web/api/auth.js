import {json, limited} from "./_shared.js";
import {dbReady, redis, getJSON, setJSON} from "./_db.js";
import {hashPassword, safeEqual, normEmail, validEmail, getUserByEmail, createUser, publicUser,
        newSession, sessionCookie, readCookie, currentUser, sameOrigin, tooManyAttempts} from "./_auth.js";

const withCookie = (obj, cookie, status = 200) => {
  const r = json(obj, status); r.headers.append("Set-Cookie", cookie); return r;
};

export async function GET(req) {
  if (!dbReady) return json({user: null, accounts: false});
  try { return json({user: publicUser(await currentUser(req)), accounts: true}); }
  catch { return json({user: null, accounts: true}); }
}

export async function POST(req) {
  if (!dbReady) return json({error: "Hesap sistemi henüz açık değil."}, 503);
  if (!sameOrigin(req)) return json({error: "Geçersiz istek"}, 403);
  if (limited(req, 30)) return json({error: "Çok fazla deneme. Birkaç dakika sonra tekrar dene."}, 429);
  let b; try { b = await req.json(); } catch { return json({error: "Geçersiz istek"}, 400); }
  const action = new URL(req.url).searchParams.get("action");

  if (action === "register") {
    const email = normEmail(b.email), pw = String(b.password || "");
    if (!validEmail(email)) return json({error: "Geçerli bir e-posta yaz."}, 400);
    if (pw.length < 8 || pw.length > 200) return json({error: "Şifre en az 8 karakter olmalı."}, 400);
    if (!b.terms) return json({error: "Kullanım Şartları'nı ve Gizlilik Politikası'nı onaylaman gerekiyor."}, 400);
    const user = await createUser({email, name: b.name, password: pw});
    if (!user) return json({error: "Bu e-postayla zaten bir hesap var. Giriş yapmayı dene."}, 409);
    return withCookie({user: publicUser(user)}, sessionCookie(await newSession(user.id)));
  }

  if (action === "login") {
    const email = normEmail(b.email);
    if (await tooManyAttempts(email)) return json({error: "Çok fazla yanlış deneme. 15 dakika sonra tekrar dene."}, 429);
    const user = await getUserByEmail(email);
    const ok = user && user.hash && safeEqual((await hashPassword(String(b.password || ""), user.salt)).hash, user.hash);
    if (!ok) {
      if (user && !user.hash && user.google) return json({error: "Bu hesap Google ile açılmış. 'Google ile devam et'i kullan."}, 400);
      return json({error: "E-posta ya da şifre hatalı."}, 401);
    }
    await redis("DEL", "tries:" + email);
    return withCookie({user: publicUser(user)}, sessionCookie(await newSession(user.id)));
  }

  if (action === "logout") {
    const tok = readCookie(req, "coder_sess");
    if (tok) await redis("DEL", "sess:" + tok);
    return withCookie({ok: true}, sessionCookie("", 0));
  }

  const user = await currentUser(req);
  if (!user) return json({error: "Önce giriş yap."}, 401);

  if (action === "update") {
    if (typeof b.name === "string" && b.name.trim()) user.name = b.name.trim().slice(0, 60);
    if (b.newPassword) {
      const np = String(b.newPassword);
      if (np.length < 8) return json({error: "Yeni şifre en az 8 karakter olmalı."}, 400);
      if (user.hash && !safeEqual((await hashPassword(String(b.password || ""), user.salt)).hash, user.hash))
        return json({error: "Mevcut şifre hatalı."}, 401);
      Object.assign(user, await hashPassword(np));
    }
    await setJSON("user:" + user.id, user);
    return json({user: publicUser(user)});
  }

  if (action === "delete") {
    if (user.hash && !safeEqual((await hashPassword(String(b.password || ""), user.salt)).hash, user.hash))
      return json({error: "Şifre hatalı."}, 401);
    await redis("DEL", "user:" + user.id, "email:" + user.email, "chats:" + user.id, "sess:" + readCookie(req, "coder_sess"));
    return withCookie({ok: true}, sessionCookie("", 0));
  }
  return json({error: "Bilinmeyen işlem"}, 400);
}
