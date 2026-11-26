// Google ile giris (OAuth 2.0). GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET Vercel ortam degiskenlerinde durur.
import {json} from "./_shared.js";
import {dbReady, redis, setJSON} from "./_db.js";
import {getUserByEmail, createUser, newSession, sessionCookie, readCookie, randomToken} from "./_auth.js";

const ID = process.env.GOOGLE_CLIENT_ID || "", SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
export const googleReady = () => Boolean(ID && SECRET);

const redirect = (to, cookies = []) => {
  const h = new Headers({Location: to, "Cache-Control": "no-store"});
  cookies.forEach(c => h.append("Set-Cookie", c));
  return new Response(null, {status: 302, headers: h});
};

export async function GET(req) {
  const url = new URL(req.url);
  const back = url.origin + "/api/google";
  if (!googleReady() || !dbReady) return redirect("/?hata=google");

  // 1) Google'a yonlendir
  if (!url.searchParams.get("code") && !url.searchParams.get("error")) {
    const state = randomToken(16);
    const q = new URLSearchParams({client_id: ID, redirect_uri: back, response_type: "code",
      scope: "openid email profile", state, prompt: "select_account"});
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + q,
      [`coder_oauth=${state}; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`]);
  }

  // 2) Google'dan donus
  const clear = "coder_oauth=; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  if (url.searchParams.get("error") || url.searchParams.get("state") !== readCookie(req, "coder_oauth"))
    return redirect("/?hata=google", [clear]);
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({code: url.searchParams.get("code"), client_id: ID, client_secret: SECRET,
        redirect_uri: back, grant_type: "authorization_code"})});
    const tok = await tr.json();
    if (!tok.access_token) throw new Error("token");
    const info = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo",
      {headers: {Authorization: "Bearer " + tok.access_token}})).json();
    if (!info.email || !info.email_verified) throw new Error("email");
    let user = await getUserByEmail(info.email);
    if (!user) user = await createUser({email: info.email, name: info.name, google: info.sub});
    else if (!user.google) { user.google = info.sub; await setJSON("user:" + user.id, user); }
    if (!user) throw new Error("user");
    return redirect("/?giris=ok", [clear, sessionCookie(await newSession(user.id))]);
  } catch (e) {
    return redirect("/?hata=google", [clear]);
  }
}
