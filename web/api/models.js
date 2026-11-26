import {BASE, KEY, json} from "./_shared.js";

// Kaliteye gore siralama: once en guclu genel modeller. Listede olmayanlar sona eklenir.
const QUALITY = [
  /deepseek\/deepseek-(r|v|chat)/, /qwen\/qwen3?.*(max|235b|plus|coder)/, /nvidia\/nemotron-3-ultra/,
  /google\/gemma-4-31b/, /meta-llama\/llama-4-maverick/, /moonshotai\/kimi/, /z-ai\/glm/,
  /nvidia\/nemotron-3\.5-super/, /google\/gemma-4-26b/, /mistralai\/(mistral-large|magistral|devstral)/,
  /baidu\/ernie/, /inclusionai\/ling/, /nvidia\/nemotron-3\.5-lightning/, /openai\/gpt-oss/,
];
// Cok kucuk/zayif modeller listeye ve yedeklere alinmaz.
const WEAK = /(\b|-)(0\.\d|1\.\d|1|2|3|4)b\b|nano|tiny|lfm-|mini\b|small/i;
let cache = null, cachedAt = 0, allFree = [];

export async function getModels() {
  if (cache && Date.now() - cachedAt < 30 * 60 * 1000) return cache;
  const r = await fetch(BASE + "/models");
  const data = (await r.json()).data || [];
  const free = data
    .filter(m => m.id.endsWith(":free") && !WEAK.test(m.id))
    .map(m => ({
      id: m.id,
      name: (m.name || m.id).replace(/\s*\(free\)\s*$/i, ""),
      vision: ((m.architecture || {}).input_modalities || []).includes("image"),
      context: m.context_length || 0,
      rank: (() => { const i = QUALITY.findIndex(rx => rx.test(m.id)); return i < 0 ? 99 : i; })(),
    }))
    .sort((a, b) => a.rank - b.rank || b.context - a.context);
  allFree = free.map(({rank, ...m}) => m);
  const pick = allFree.slice(0, 7);
  const vis = allFree.find(m => m.vision);
  if (vis && !pick.some(m => m.vision)) pick.push(vis);
  cache = pick;
  cachedAt = Date.now();
  return cache;
}

export async function getAllFree() {
  await getModels();
  return allFree;
}

export async function GET() {
  if (!KEY) return json({models: []});
  try {
    const list = await getModels();
    // "Otomatik": her istekte bosta olan en iyi ucretsiz modeli kullanir (gorsel varsa gorsel destekli olani).
    return json({models: [{id: "auto", name: "Otomatik (en iyi)", vision: true, auto: true}, ...list]});
  } catch (e) {
    return json({models: cache || [], error: "Model listesi alınamadı"}, cache ? 200 : 502);
  }
}
