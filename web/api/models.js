import {BASE, KEY, json} from "./_shared.js";

// Bilinen guclu saglayicilar once gelsin.
const PREFER = ["deepseek", "qwen", "google", "meta-llama", "mistralai", "moonshotai", "z-ai", "openai", "nvidia"];
let cache = null, cachedAt = 0, allFree = [];

export async function getModels() {
  if (cache && Date.now() - cachedAt < 30 * 60 * 1000) return cache;
  {
    const r = await fetch(BASE + "/models");
    const data = (await r.json()).data || [];
    const free = data
      .filter(m => m.id.endsWith(":free"))
      .map(m => ({
        id: m.id,
        name: (m.name || m.id).replace(/\s*\(free\)\s*$/i, ""),
        vision: ((m.architecture || {}).input_modalities || []).includes("image"),
        context: m.context_length || 0,
        rank: (() => { const i = PREFER.indexOf(m.id.split("/")[0]); return i < 0 ? 99 : i; })(),
      }))
      .sort((a, b) => a.rank - b.rank || b.context - a.context);
    allFree = free.map(({rank, ...m}) => m);
    const pick = free.slice(0, 7);
    const vis = free.find(m => m.vision);
    if (vis && !pick.some(m => m.vision)) pick.push(vis);
    cache = pick.map(({rank, ...m}) => m);
    cachedAt = Date.now();
    return cache;
  }
}

export async function getAllFree() {
  await getModels();
  return allFree;
}

export async function GET() {
  if (!KEY) return json({models: []});
  try {
    return json({models: await getModels()});
  } catch (e) {
    return json({models: cache || [], error: "Model listesi alinamadi"}, cache ? 200 : 502);
  }
}
