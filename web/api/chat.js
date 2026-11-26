import {BASE, KEY, json, limited} from "./_shared.js";
import {getAllFree} from "./models.js";
import {dbReady} from "./_db.js";
import {currentUser} from "./_auth.js";

export const config = {maxDuration: 300};

export async function POST(req) {
  if (!KEY) return json({error: {message: "Paylaşılan anahtar ayarlanmamış."}}, 503);
  // Hesap sistemi aciksa yalnizca giris yapmis kullanicilar kullanabilir.
  if (dbReady) {
    let user = null;
    try { user = await currentUser(req); } catch {}
    if (!user) return json({error: {code: "login", message: "Devam etmek için giriş yap."}}, 401);
  }
  if (limited(req)) return json({error: {message: "Çok fazla istek gönderdin. Birkaç dakika sonra tekrar dene."}}, 429);

  let body;
  try { body = await req.json(); } catch { return json({error: {message: "Geçersiz istek"}}, 400); }

  // Yalnizca ucretsiz modeller: anahtar kotuye kullanilsa bile para harcanamaz.
  if (typeof body.model !== "string" || !(body.model.endsWith(":free") || body.model === "openrouter/free")) {
    return json({error: {message: "Bu sitede yalnızca ücretsiz modeller kullanılabilir."}}, 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length > 200) {
    return json({error: {message: "Geçersiz mesajlar"}}, 400);
  }

  // Secilen model mesgulse (ucretsiz modellerde sik olur) baska ucretsiz modellere,
  // en sonda da OpenRouter'in bosta olan ucretsiz modeli secen yonlendiricisine gec.
  const hasImage = body.messages.some(m => Array.isArray(m.content) && m.content.some(p => p && p.type === "image_url"));
  const candidates = [body.model];
  try {
    for (const m of await getAllFree()) {
      if (candidates.length >= 6) break;
      if (!candidates.includes(m.id) && (!hasImage || m.vision)) candidates.push(m.id);
    }
  } catch {}
  candidates.push("openrouter/free");

  const call = (model, signal) => fetch(BASE + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + KEY,
      "HTTP-Referer": "https://coder-tr.vercel.app",
      "X-Title": "Coder",
    },
    body: JSON.stringify({
      model,
      messages: body.messages,
      stream: true,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.3,
      max_tokens: 8000,
    }),
    signal,
  });

  const result = await race(candidates, call, req.signal);
  if (result.res) {
    return new Response(result.res.body, {
      status: 200,
      headers: {
        "Content-Type": result.res.headers.get("content-type") || "text/event-stream",
        "Cache-Control": "no-store",
        "X-Coder-Model": result.model,
      },
    });
  }
  if (result.daily) return json({error: {code: "daily", message: "Bugünkü ücretsiz kullanım hakkı doldu."}}, 429);
  return json({error: {code: "busy", message: "Ücretsiz modeller şu an çok yoğun."}}, 503);
}

// "Hedged" yaris: secilen modelle baslar; 1 sn icinde cevap gelmezse ya da hata verirse
// siradaki modeli de baslatir (en fazla 3 ayni anda). Ilk basarili cevap kazanir, digerleri iptal edilir.
function race(candidates, call, outerSignal) {
  return new Promise(resolve => {
    const ctrls = [];
    let idx = 0, active = 0, done = false, timer = null;
    const finish = r => {
      if (done) return;
      done = true; clearInterval(timer);
      ctrls.forEach(c => { if (c !== r.ctrl) c.abort(); });
      resolve(r);
    };
    if (outerSignal) outerSignal.addEventListener("abort", () => finish({aborted: true}));
    const launch = () => {
      if (done) return;
      if (idx >= candidates.length) { if (active === 0) finish({}); return; }
      const model = candidates[idx++];
      const ctrl = new AbortController(); ctrls.push(ctrl); active++;
      call(model, ctrl.signal).then(async res => {
        active--;
        if (done) { ctrl.abort(); return; }
        if (res.ok) return finish({res, model, ctrl});
        const text = await res.text().catch(() => "");
        if (/per-day|per day|daily/i.test(text)) return finish({daily: true});
        launch();
      }).catch(() => { active--; if (!done) launch(); });
    };
    launch();
    timer = setInterval(() => { if (!done && active < 3 && idx < candidates.length) launch(); }, 1000);
  });
}
