// Upstash Redis (REST) — ek paket gerektirmez. Vercel entegrasyonu KV_* ya da UPSTASH_* adlariyla ekler.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const dbReady = Boolean(URL_ && TOKEN);

export async function redis(...cmd) {
  if (!dbReady) throw new Error("Veritabani ayarlanmamis");
  const r = await fetch(URL_, {
    method: "POST",
    headers: {Authorization: "Bearer " + TOKEN, "Content-Type": "application/json"},
    body: JSON.stringify(cmd.map(String)),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
export const getJSON = async k => { const v = await redis("GET", k); return v ? JSON.parse(v) : null; };
export const setJSON = (k, v, ttl) => ttl ? redis("SET", k, JSON.stringify(v), "EX", ttl) : redis("SET", k, JSON.stringify(v));
