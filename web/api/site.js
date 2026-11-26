// /p/<kimlik>/<yol> adreslerini sunar (vercel.json yonlendirmesi). Kullanici icerigi Code-Tr ile ayni adreste
// oldugu icin her yanit CSP "sandbox" ile ayri (opak) bir kokene alinir: sayfa Code-Tr oturumuna, cerezlerine
// ve tarayici depolamasina erisemez. Google'a kapali (noindex).
import {dbReady, redis, getJSON} from "./_db.js";

const SANDBOX = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";
const page = (status, title, msg) => new Response(
  `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<body style="font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f7f5f1;color:#18191d;text-align:center;padding:20px"><div><h1 style="font-size:22px">${title}</h1><p style="color:#5d5f66">${msg}</p></div></body></html>`,
  {status, headers: {"Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": SANDBOX, "X-Robots-Tag": "noindex", "Cache-Control": "no-store"}});

export async function GET(req) {
  if (!dbReady) return page(503, "Şu an açılamıyor", "Birazdan tekrar dene.");
  const q = new URL(req.url).searchParams, id = String(q.get("id") || "");
  let path = decodeURIComponent(String(q.get("path") || "")).replace(/^\/+/, "");
  if (!/^[\w-]{4,20}$/.test(id) || path.split("/").includes("..")) return page(404, "Sayfa bulunamadı", "Link hatalı ya da silinmiş olabilir.");
  const s = await getJSON("share:" + id);
  if (!s || !s.ver) return page(404, "Sayfa bulunamadı", "Link hatalı ya da silinmiş olabilir.");
  const files = new Map((s.files || []).map(f => [f.path, f.type]));
  if (!path || path.endsWith("/")) path += "index.html";
  if (!files.has(path) && files.has(path + "/index.html")) path += "/index.html";
  if (!files.has(path) && files.has(path + ".html")) path += ".html";
  if (!files.has(path)) {
    const nf = files.has("404.html") ? "404.html" : "";
    if (!nf) return page(404, "Sayfa bulunamadı", "Bu projede böyle bir sayfa yok.");
    path = nf;
  }
  const data = await redis("GET", "sf:" + id + ":" + s.ver + ":" + path);
  if (data == null) return page(404, "Sayfa bulunamadı", "Dosya bulunamadı.");
  let type = files.get(path) || "application/octet-stream";
  if (/^text\/|javascript|json|svg|xml/.test(type) && !/charset/.test(type)) type += "; charset=utf-8";
  let body = Buffer.from(data, "base64");
  // Link sonunda "/" olmasa da goreli yollar dogru calissin: HTML'e <base> ekle
  if (/^text\/html/.test(type)) {
    let html = body.toString("utf8");
    if (!/<base\s/i.test(html)) {
      const base = `<base href="/p/${id}/${path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : ""}">`;
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + base) : base + html;
      body = Buffer.from(html, "utf8");
    }
  }
  return new Response(body, {status: path === "404.html" && q.get("path") !== "404.html" ? 404 : 200, headers: {
    "Content-Type": type, "Content-Security-Policy": SANDBOX, "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*", "Referrer-Policy": "no-referrer",
    "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300"}});
}
