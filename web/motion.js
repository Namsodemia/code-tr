// Code-Tr Motion: konusmaya senkron kurumsal motion design (tarayicida, cihazda).
// Sahneler canvas'ta kare kare cizilir (zamanin saf fonksiyonu), FFmpeg ile videoya bindirilir;
// altyazi ve isim etiketi ASS (libass) ile islenir. Hicbir dis servise bagli degildir.

export const PALETTES = {
  kurumsal: {bg1: "#f4f5f8", bg2: "#e6e9ef", navy: "#141c3c", red: "#d81f2a", gray: "#5c6272", line: "#c9cdd6", card: "#ffffff"},
  dinamik:  {bg1: "#fff7f0", bg2: "#ffe6d4", navy: "#1a1a1a", red: "#f0641a", gray: "#6a5a50", line: "#e8cdb8", card: "#ffffff"},
  minimal:  {bg1: "#f7f7f7", bg2: "#ececec", navy: "#111111", red: "#111111", gray: "#777777", line: "#d6d6d6", card: "#ffffff"},
};
let FPS = 30;
// Glow Up modu: marka rengi/fontu, pop-scale yok, golge yok, guvenli alan, tam ekran sahnede altyazi yok.
let STYLE = {};
// Her video farkli gorunsun: font, renk, zemin, gecis ve altyazi dili her seferinde degisir (son kullanilan tekrarlanmaz).
const PAL = {
  lacivert: {navy: "#141c3c", red: "#d81f2a"}, zumrut: {navy: "#0f3d3e", red: "#19a974"}, murekkep: {navy: "#1b1b3a", red: "#6c5ce7"},
  komur: {navy: "#161616", red: "#e0b400"}, bordo: {navy: "#3b0d1a", red: "#c2185b"}, okyanus: {navy: "#0b2545", red: "#139bb8"},
  orman: {navy: "#1f3d2b", red: "#7fb33a"}, gece: {navy: "#10141f", red: "#3d7bff"},
};
const FONTS = ["Montserrat", "Archivo", "Sora", "Space Grotesk", "Outfit", "Plus Jakarta Sans", "Barlow Condensed", "Bricolage Grotesque", "Lexend", "Manrope"];
const BGS = ["gradient", "solid", "grid", "editorial"], WIPES = ["none", "none", "diag"], CAPS = ["pop", "glide", "twolayer", "karaoke", "left", "highlight", "spotlight"], SOFT_CAPS = ["glide", "twolayer", "karaoke", "left", "highlight", "highlight", "spotlight"];
export const FORMATS = ["info", "kinetik", "cerceve", "sade", "bolunmus"];
// Kullanicinin istegindeki kelimeler once gelir; yazmadigi her sey bir oncekinden farkli secilir.
export function pickLook(prev = {}, prefer = "", ai = {}){
  const pick = (arr, old) => { const c = arr.filter(x => x !== old); return c[Math.floor(Math.random() * c.length)]; };
  const q = String(prefer).toLocaleLowerCase("tr"), has = rx => rx.test(q);
  const askedInfo = has(/infografi|grafik|şema|adım|referans/);
  if(ai.format === "info" && !askedInfo) ai = {...ai, format: ""};   // referans sablonu istenmedikce secme
  const fmt = FORMATS.includes(ai.format) ? ai.format : has(/sade|minimal|yalnız altyazı|sadece altyazı/) ? "sade" : has(/enerjik|dinamik|tiktok|hızlı|kinetik|dev yazı|büyük yazı/) ? "kinetik" : has(/haber|belgesel|çerçeve|editoryal|dergi/) ? "cerceve" : has(/bölünmüş|split|ikiye böl|yarım ekran/) ? "bolunmus" : askedInfo ? "info" : pick(FORMATS.filter(f => f !== "info"), prev.fmt);
  const colors = {mavi: "okyanus", lacivert: "lacivert", kurumsal: "lacivert", yeşil: "zumrut", mor: "murekkep", sarı: "komur", siyah: "komur", bordo: "bordo", pembe: "bordo", kırmızı: "lacivert", doğa: "orman"};
  const ck = Object.keys(colors).find(k => q.includes(k));
  const palKey = PAL[ai.renk] ? ai.renk : ck ? colors[ck] : pick(Object.keys(PAL), prev.pal);
  if(ai.altyazi === "pop" && !has(/zıpla|pop/)) ai = {...ai, altyazi: ""};   // sert altyazi istenmedikce yok
  const cap = CAPS.includes(ai.altyazi) ? ai.altyazi : has(/karaoke/) ? "karaoke" : has(/kutu|vurgu kutusu|highlight|kayan/) ? "highlight" : has(/spot|odak/) ? "spotlight" : has(/kelime kelime|yumuşak|soft|zarif/) ? "glide" : has(/sola|sol hizalı/) ? "left" : has(/iki katman|büyük altyazı|vurgulu/) ? "twolayer" : has(/zıpla|pop/) ? "pop" : pick(SOFT_CAPS, prev.cap);
  const font = FONTS.includes(ai.font) ? ai.font : has(/dar|condensed/) ? "Barlow Condensed" : has(/modern|teknoloji/) ? "Space Grotesk" : pick(FONTS, prev.font);
  const hex = (String(prefer).match(/#[0-9a-f]{6}\b/gi) || []).slice(0, 2);
  const fm = String(prefer).match(/font\s*[:=]\s*([A-Za-zÇĞİÖŞÜçğıöşü ]{3,30}?)(?:[,.\n]|$)/i);
  return {fmt, cards: has(/kart|ikon|donanım/), align: Math.random() < .5 ? "center" : "left", pal: palKey, font: fm ? fm[1].trim() : font, hex: hex.length ? hex : null, bg: pick(BGS, prev.bg), wipe: pick(WIPES, prev.wipe), cap, full: /arka ?plansız|şeffaf|seffaf|kesme|kesmesin/i.test(prefer) ? "none" : /tam ekran/i.test(prefer) ? "all" : ""};
}
export function lookPalette(l){ const c = l.hex ? {navy: l.hex[0], red: l.hex[1] || l.hex[0]} : (PAL[l.pal] || PAL.lacivert); return {bg1: "#f5f5f3", bg2: "#e8e8e4", navy: c.navy, red: c.red, gray: "#5f6368", line: "#d0d0cc", card: "#ffffff"}; }
export function brandPalette(b){ return {bg1: "#f6f6f4", bg2: "#ecebe7", navy: b.c1, red: b.c2, gray: "#5f6368", line: "#d4d4d0", card: "#ffffff"}; }

// ---------- yardimcilar ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// Yumuşak: yavaş başlar, yavaş durur (sert "çat" girişler yok)
const easeOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
let SLOW = 1.6;
const easeBack = t => { if(STYLE.glow || STYLE.noback) return easeOut(t); t = clamp(t); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const prog = (t, start, dur) => clamp((t - start * SLOW) / (dur * SLOW));
function rr(ctx, x, y, w, h, r){ r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function font(ctx, size, weight = 800){ ctx.font = (STYLE.italic ? "italic " : "") + weight + " " + Math.round(size) + "px " + (STYLE.font ? '"' + STYLE.font + '", ' : "") + "Montserrat, Manrope, sans-serif"; }
function spaced(ctx, text, x, y, spacing){ let cx = x; for(const ch of text){ ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; } return cx - x; }
function shadowCard(ctx, x, y, w, h, r, P, a = 1){
  if(STYLE.glow){ ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = P.card; ctx.fillRect(x, y, w, h); ctx.fillStyle = P.line; ctx.fillRect(x, y + h - 2, w, 2); ctx.restore(); return; }
  ctx.save(); ctx.globalAlpha *= a; ctx.shadowColor = "rgba(20,28,60,0.12)"; ctx.shadowBlur = h * 0.18; ctx.shadowOffsetY = h * 0.06;
  ctx.fillStyle = P.card; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
}
function fitText(ctx, text, maxW, size, weight = 800){ let s = size; font(ctx, s, weight); while(ctx.measureText(text).width > maxW && s > size * 0.45){ s *= 0.94; font(ctx, s, weight); } return s; }

// ---------- simgeler (basit vektor) ----------
function icon(ctx, name, cx, cy, r, color){
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.lineCap = "round"; ctx.lineJoin = "round";
  const n = String(name || "").toLowerCase();
  if(/gear|ayar|kurulum|setup/.test(n)){ ctx.beginPath(); for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4; ctx.moveTo(cx + Math.cos(a) * r * .55, cy + Math.sin(a) * r * .55); ctx.lineTo(cx + Math.cos(a) * r * .9, cy + Math.sin(a) * r * .9); } ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * .5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * .18, 0, 7); ctx.fill(); }
  else if(/check|onay|test|tamam/.test(n)){ ctx.beginPath(); ctx.moveTo(cx - r * .45, cy); ctx.lineTo(cx - r * .1, cy + r * .35); ctx.lineTo(cx + r * .5, cy - r * .35); ctx.stroke(); }
  else if(/play|basla|canli|launch|yayin/.test(n)){ ctx.beginPath(); ctx.arc(cx, cy, r * .8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - r * .22, cy - r * .35); ctx.lineTo(cx + r * .38, cy); ctx.lineTo(cx - r * .22, cy + r * .35); ctx.closePath(); ctx.fill(); }
  else if(/globe|internet|web|dunya/.test(n)){ ctx.beginPath(); ctx.arc(cx, cy, r * .8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy, r * .35, r * .8, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - r * .8, cy); ctx.lineTo(cx + r * .8, cy); ctx.stroke(); }
  else if(/users|people|ekip|egitim|referans|team|insan/.test(n)){ for(const [dx, s] of [[-.42, .7], [.42, .7], [0, 1]]){ ctx.beginPath(); ctx.arc(cx + dx * r, cy - r * .25 * s, r * .22 * s, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + dx * r, cy + r * .55 * s, r * .38 * s, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); } }
  else if(/person|kisi|user|muhendis/.test(n)){ ctx.beginPath(); ctx.arc(cx, cy - r * .25, r * .28, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx, cy + r * .65, r * .52, Math.PI * 1.1, Math.PI * 1.9); ctx.fill(); }
  else if(/build|bina|fabrika|sirket|office/.test(n)){ ctx.strokeRect(cx - r * .45, cy - r * .7, r * .6, r * 1.4); ctx.strokeRect(cx + r * .15, cy - r * .2, r * .35, r * .9); for(let i = 0; i < 3; i++) ctx.fillRect(cx - r * .3, cy - r * .5 + i * r * .38, r * .3, r * .14); }
  else if(/chart|grafik|rapor|bar|artis/.test(n)){ for(let i = 0; i < 3; i++){ const h = r * (.5 + i * .35); ctx.fillRect(cx - r * .6 + i * r * .45, cy + r * .6 - h, r * .3, h); } }
  else if(/money|para|tahsilat|odeme|tl/.test(n)){ ctx.beginPath(); ctx.arc(cx, cy, r * .75, 0, 7); ctx.stroke(); font(ctx, r * .9, 800); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("₺", cx, cy + r * .05); }
  else if(/shield|guven|takip|kalkan/.test(n)){ ctx.beginPath(); ctx.moveTo(cx, cy - r * .8); ctx.lineTo(cx + r * .65, cy - r * .5); ctx.lineTo(cx + r * .55, cy + r * .3); ctx.lineTo(cx, cy + r * .8); ctx.lineTo(cx - r * .55, cy + r * .3); ctx.lineTo(cx - r * .65, cy - r * .5); ctx.closePath(); ctx.stroke(); }
  else if(/phone|telefon|ara/.test(n)){ rr(ctx, cx - r * .38, cy - r * .75, r * .76, r * 1.5, r * .15); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy + r * .5, r * .08, 0, 7); ctx.fill(); }
  else { ctx.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .35 : r * .8; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

// ---------- ortak sahne parcalari ----------
function background(ctx, W, H, t, P, dark){
  if(STYLE.glow){ ctx.fillStyle = dark ? P.navy : P.bg1; ctx.fillRect(0, 0, W, H); if(!dark){ ctx.fillStyle = P.bg2; ctx.fillRect(0, H * .82, W, H * .18); } return; }
  if(STYLE.bg === "solid"){ ctx.fillStyle = dark ? P.navy : P.bg1; ctx.fillRect(0, 0, W, H); ctx.fillStyle = P.red; ctx.fillRect(0, H - 10, W * (.2 + .1 * Math.sin(t)), 10); return; }
  if(STYLE.bg === "grid"){ ctx.fillStyle = dark ? P.navy : P.bg1; ctx.fillRect(0, 0, W, H); const g = Math.min(W, H) / 12; ctx.strokeStyle = dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"; ctx.lineWidth = 1; ctx.beginPath(); const o = (t * 12) % g; for(let x = -o; x < W; x += g){ ctx.moveTo(x, 0); ctx.lineTo(x, H); } for(let y = 0; y < H; y += g){ ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); return; }
  if(STYLE.bg === "editorial"){ ctx.fillStyle = dark ? P.navy : P.bg1; ctx.fillRect(0, 0, W, H); ctx.fillStyle = dark ? "rgba(255,255,255,.06)" : P.bg2; ctx.fillRect(0, 0, W * .09, H); ctx.fillStyle = P.red; ctx.fillRect(W * .09 - 6, H * .12, 6, H * .22 * clamp(t / .6)); return; }
  if(dark){ const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, P.navy); g.addColorStop(1, "#0b1128"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(W * .35, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * .55); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // suzulen kucuk cizgiler (dekor)
  const s = Math.min(W, H) / 1080;
  const dashes = [[.62, .05], [.12, .22], [.82, .34], [.3, .62], [.75, .78], [.15, .9], [.55, .96]];
  ctx.save(); ctx.lineWidth = 2 * s;
  dashes.forEach(([x, y], i) => {
    const dx = ((t * 18 * s * (i % 2 ? 1 : -1)) % (W * .1));
    const px = x * W + dx, py = y * H;
    ctx.strokeStyle = dark ? "rgba(255,255,255,.25)" : (i % 3 ? "rgba(216,31,42,.55)" : "rgba(20,28,60,.25)");
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 60 * s, py); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(px + 60 * s, py, 3 * s, 0, 7); ctx.fill();
  });
  ctx.restore();
}
function header(ctx, L, t, P, d){
  const {x, y, w, s} = L;
  const pe = easeOut(prog(t, .05, .35));
  const OV = STYLE.ov;
  ctx.save(); ctx.globalAlpha = pe; ctx.fillStyle = OV ? "#ffffff" : P.gray; font(ctx, 22 * s, 800); ctx.textBaseline = "alphabetic";
  spaced(ctx, String(d.eyebrow || "").toLocaleUpperCase("tr"), x, y - 10 * s * (1 - pe) , 5 * s); ctx.restore();
  const lines = [[d.title1 || "", OV ? "#ffffff" : P.navy], [d.title2 || "", P.red]];
  let yy = y + 78 * s;
  lines.forEach(([txt, col], i) => {
    if(!txt) return;
    const size = fitText(ctx, txt, w, 76 * s, 900);
    const p = easeOut(prog(t, .12 + i * .1, .45));
    ctx.save(); ctx.beginPath(); ctx.rect(x - 10 * s, yy - size * 1.05, w + 20 * s, size * 1.3); ctx.clip();
    font(ctx, size, 900); if(OV){ ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = size * .08; ctx.lineJoin = "round"; ctx.strokeText(txt, x, yy + size * (1 - p)); }
    ctx.fillStyle = col; ctx.fillText(txt, x, yy + size * (1 - p)); ctx.restore();
    yy += size * 1.08;
  });
  return yy + 30 * s;
}
function wipe(ctx, W, H, t, P){
  const p = prog(t, 0, .45); if(p >= 1 || STYLE.wipe === "none") return;
  if(STYLE.wipe === "bars"){ ctx.save(); ctx.fillStyle = P.red; for(let i = 0; i < 5; i++){ const q = easeOut(clamp(p * 1.6 - i * .12)); ctx.fillRect(i * W / 5, H * q, W / 5 + 1, H * (1 - q)); } ctx.restore(); return; }
  if(STYLE.wipe === "iris"){ ctx.save(); ctx.fillStyle = P.navy; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.hypot(W, H) * .6 * easeOut(p), 0, 7, true); ctx.fill("evenodd"); ctx.restore(); return; }
  if(STYLE.wipe === "slide"){ ctx.save(); ctx.fillStyle = P.navy; ctx.fillRect(W * easeOut(p), 0, W, H); ctx.fillStyle = P.red; ctx.fillRect(W * easeOut(p) - 12, 0, 12, H); ctx.restore(); return; }
  const x = -W * .6 + easeOut(p) * W * 2.2;
  ctx.save(); ctx.fillStyle = P.red; ctx.globalAlpha = 1 - p * .2;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + W * .22, 0); ctx.lineTo(x + W * .22 - H * .25, H); ctx.lineTo(x - H * .25, H); ctx.closePath(); ctx.fill(); ctx.restore();
}

// ---------- sahne sablonlari ----------
const SCENES = {
  // Adim listesi: kartlar sirayla gelir, son adim vurgulu
  adimlar(ctx, L, t, P, d){
    const {x, w, s} = L; let y = header(ctx, L, t, P, d);
    const items = (d.items || []).slice(0, 5); const hi = d.vurgu ?? items.length - 1;
    const ch = 92 * s, gap = 24 * s, nodeX = x + 30 * s, cardX = x + 80 * s, cw = w - 80 * s;
    const lineP = easeOut(prog(t, .35, .4 + items.length * .45));
    ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(nodeX, y - 20 * s); ctx.lineTo(nodeX, y - 20 * s + (items.length * (ch + gap)) * lineP); ctx.stroke();
    ctx.strokeStyle = P.red; ctx.beginPath(); ctx.moveTo(nodeX, y - 20 * s); ctx.lineTo(nodeX, y + 10 * s); ctx.stroke(); ctx.restore();
    items.forEach((it, i) => {
      const p = easeOut(prog(t, .45 + i * .45, .4)); if(p <= 0) return;
      const cy = y + i * (ch + gap), on = i === hi && t > .45 + i * .45 + .25;
      ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - p) * 60 * s, 0);
      ctx.fillStyle = P.navy; ctx.beginPath(); ctx.arc(nodeX, cy + ch / 2, 24 * s, 0, 7); ctx.fill();
      if(on){ ctx.strokeStyle = P.red; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(nodeX, cy + ch / 2, 31 * s, 0, 7); ctx.stroke(); }
      icon(ctx, it.icon || it.label, nodeX, cy + ch / 2, 14 * s, "#fff");
      if(on){ ctx.fillStyle = P.red; rr(ctx, cardX, cy, cw, ch, 8 * s); ctx.fill(); }
      else { shadowCard(ctx, cardX, cy, cw, ch, 8 * s, P); ctx.fillStyle = P.red; ctx.fillRect(cardX, cy, 6 * s, ch); }
      ctx.fillStyle = on ? "#fff" : P.navy; const fs = fitText(ctx, it.label || "", cw - 140 * s, 40 * s, 800); ctx.textBaseline = "middle"; ctx.fillText(it.label || "", cardX + 30 * s, cy + ch / 2 + 2 * s);
      icon(ctx, it.icon || it.label, cardX + cw - 50 * s, cy + ch / 2, 20 * s, on ? "#fff" : "#aab0bd");
      void fs; ctx.restore();
    });
  },
  // Kaynak / secenek kartlari (2-4)
  kartlar(ctx, L, t, P, d){
    const {x, w, s} = L; const y = header(ctx, L, t, P, d);
    const items = (d.items || []).slice(0, 4); const cols = items.length > 2 ? 2 : items.length || 1;
    const cw = (w - (cols - 1) * 24 * s) / cols, ch = 150 * s;
    items.forEach((it, i) => {
      const p = easeBack(prog(t, .5 + i * .3, .45)); if(p <= 0) return;
      const cx = x + (i % cols) * (cw + 24 * s), cy = y + Math.floor(i / cols) * (ch + 24 * s);
      ctx.save(); ctx.globalAlpha = clamp(p); ctx.translate(cx + cw / 2, cy + ch / 2); ctx.scale(.85 + .15 * p, .85 + .15 * p); ctx.translate(-(cx + cw / 2), -(cy + ch / 2));
      shadowCard(ctx, cx, cy, cw, ch, 8 * s, P); ctx.fillStyle = P.red; ctx.fillRect(cx, cy, 6 * s, ch);
      ctx.fillStyle = P.navy; ctx.beginPath(); ctx.arc(cx + 58 * s, cy + ch / 2, 32 * s, 0, 7); ctx.fill(); icon(ctx, it.icon || it.label, cx + 58 * s, cy + ch / 2, 19 * s, "#fff");
      ctx.fillStyle = P.gray; font(ctx, 17 * s, 800); ctx.textBaseline = "alphabetic"; spaced(ctx, String(it.ust || "").toLocaleUpperCase("tr"), cx + 108 * s, cy + ch / 2 - 14 * s, 3 * s);
      ctx.fillStyle = P.navy; fitText(ctx, it.label || "", cw - 125 * s, 36 * s, 800); ctx.fillText(it.label || "", cx + 108 * s, cy + ch / 2 + 26 * s);
      ctx.restore();
    });
  },
  // Sayi + simge sirasi (or. 8 muhendis)
  sayi(ctx, L, t, P, d){
    const {x, w, s} = L; let y = header(ctx, L, t, P, d);
    const n = Math.max(1, Math.min(12, parseInt(d.adet) || 6)); const r = Math.min(28 * s, (w / n - 10 * s) / 2);
    for(let i = 0; i < n; i++){
      const p = easeBack(prog(t, .5 + i * .12, .35)); if(p <= 0) continue;
      const cx = x + r + i * (w - 2 * r) / Math.max(1, n - 1), cy = y + r;
      ctx.save(); ctx.globalAlpha = clamp(p); ctx.fillStyle = i === n - 1 ? P.red : P.navy; ctx.beginPath(); ctx.arc(cx, cy, r * clamp(p, 0, 1.2), 0, 7); ctx.fill(); icon(ctx, d.icon || "person", cx, cy, r * .6, "#fff"); ctx.restore();
    }
    y += 2 * r + 30 * s;
    if(d.label){ const p = easeOut(prog(t, .5 + n * .12 + .1, .45)); if(p > 0){
      ctx.save(); ctx.globalAlpha = p; ctx.strokeStyle = P.red; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x + w - r, y - 26 * s); ctx.lineTo(x + w - r, y + 4 * s); ctx.stroke();
      const ch = 150 * s; shadowCard(ctx, x, y + 14 * s, w, ch, 8 * s, P); ctx.fillStyle = P.red; ctx.fillRect(x, y + 14 * s, 6 * s, ch);
      ctx.fillStyle = "#eef0f5"; rr(ctx, x + 30 * s, y + 38 * s, 100 * s, 100 * s, 10 * s); ctx.fill(); icon(ctx, d.icon2 || "building", x + 80 * s, y + 88 * s, 34 * s, P.navy);
      ctx.fillStyle = P.gray; font(ctx, 18 * s, 800); spaced(ctx, String(d.label).toLocaleUpperCase("tr"), x + 160 * s, y + 70 * s, 3 * s);
      if(d.alt){ ctx.fillStyle = P.navy; fitText(ctx, d.alt, w - 180 * s, 34 * s, 800); ctx.fillText(d.alt, x + 160 * s, y + 118 * s); }
      ctx.restore(); } }
  },
  // Rapor karti + buyuyen sutunlar
  grafik(ctx, L, t, P, d){
    const {x, w, s} = L; const y = header(ctx, L, t, P, d);
    const vals = (d.degerler || [3, 4, 3.5, 5, 7]).slice(0, 6).map(Number); const mx = Math.max(...vals, 1);
    const p0 = easeOut(prog(t, .45, .4)); if(p0 <= 0) return;
    const ch = 300 * s;
    ctx.save(); ctx.globalAlpha = p0; ctx.translate(0, (1 - p0) * 40 * s);
    shadowCard(ctx, x, y, w, ch, 6 * s, P); ctx.fillStyle = P.navy; ctx.fillRect(x, y, w, 52 * s);
    ctx.fillStyle = "#fff"; font(ctx, 19 * s, 800); ctx.textBaseline = "middle"; spaced(ctx, String(d.label || "RAPOR").toLocaleUpperCase("tr"), x + 26 * s, y + 27 * s, 3 * s);
    for(let i = 0; i < 4; i++){ ctx.fillStyle = i === 0 ? P.red : P.navy; ctx.fillRect(x + 30 * s, y + 92 * s + i * 42 * s, 10 * s, 10 * s); ctx.fillStyle = "#d9dce4"; ctx.fillRect(x + 54 * s, y + 94 * s + i * 42 * s, (170 - i * 25) * s, 7 * s); }
    const bw = 34 * s, bx0 = x + w - 40 * s - vals.length * (bw + 14 * s), base = y + ch - 36 * s;
    vals.forEach((v, i) => { const p = easeOut(prog(t, .7 + i * .12, .5)); const h = (v / mx) * 190 * s * p; ctx.fillStyle = i === vals.length - 1 ? P.red : P.navy; ctx.fillRect(bx0 + i * (bw + 14 * s), base - h, bw, h); });
    ctx.restore();
  },
  // Zaman cizelgesi: noktalar sirayla
  zaman(ctx, L, t, P, d){
    const {x, w, s} = L; const y = header(ctx, L, t, P, d) + 40 * s;
    const items = (d.items || []).slice(0, 6); const n = Math.max(2, items.length);
    const lp = easeOut(prog(t, .45, .3 + n * .3));
    ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(x + 20 * s, y); ctx.lineTo(x + w - 20 * s, y); ctx.stroke();
    ctx.strokeStyle = P.red; ctx.beginPath(); ctx.moveTo(x + 20 * s, y); ctx.lineTo(x + 20 * s + (w - 40 * s) * lp, y); ctx.stroke(); ctx.restore();
    items.forEach((it, i) => {
      const cx = x + 20 * s + i * (w - 40 * s) / (n - 1); const p = easeBack(prog(t, .5 + i * .3, .35)); if(p <= 0) return;
      const last = i === items.length - 1;
      ctx.save(); ctx.globalAlpha = clamp(p); ctx.fillStyle = last ? P.red : P.navy; ctx.beginPath(); ctx.arc(cx, y, 20 * s * clamp(p, 0, 1.15), 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(cx - 7 * s, y); ctx.lineTo(cx - 2 * s, y + 6 * s); ctx.lineTo(cx + 8 * s, y - 6 * s); ctx.stroke();
      ctx.fillStyle = P.navy; font(ctx, 22 * s, 800); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(it.label || it, cx, y + 36 * s); ctx.restore();
    });
  },
  // Baslangictan sonuca yol
  yol(ctx, L, t, P, d){
    const {x, w, s} = L; const y = header(ctx, L, t, P, d) + 10 * s;
    const bw = 260 * s, bh = 96 * s;
    const p1 = easeOut(prog(t, .4, .35)); if(p1 <= 0) return;
    ctx.save(); ctx.globalAlpha = p1; shadowCard(ctx, x, y, bw, bh, 6 * s, P); ctx.fillStyle = P.red; ctx.fillRect(x, y, 6 * s, bh);
    ctx.fillStyle = P.gray; font(ctx, 16 * s, 800); ctx.textBaseline = "alphabetic"; spaced(ctx, String(d.ust1 || "BAŞLANGIÇ").toLocaleUpperCase("tr"), x + 24 * s, y + 34 * s, 3 * s);
    ctx.fillStyle = P.navy; fitText(ctx, d.bas || "", bw - 40 * s, 34 * s, 800); ctx.fillText(d.bas || "", x + 24 * s, y + 74 * s); ctx.restore();
    const sx = x + 90 * s, sy = y + bh, ex = x + w - 70 * s, ey = y + bh + 290 * s;
    const pp = easeOut(prog(t, .7, 1.1));
    const pt = u => { const a = 1 - u; const c1 = [sx, sy + 150 * s], c2 = [ex, ey - 200 * s]; return [a*a*a*sx + 3*a*a*u*c1[0] + 3*a*u*u*c2[0] + u*u*u*ex, a*a*a*sy + 3*a*a*u*c1[1] + 3*a*u*u*c2[1] + u*u*u*ey]; };
    ctx.save(); ctx.strokeStyle = P.red; ctx.lineWidth = 8 * s; ctx.lineCap = "round"; ctx.beginPath();
    for(let k = 0; k <= 60 * pp; k++){ const [px, py] = pt(k / 60); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    const dots = (d.adimlar || 4);
    for(let k = 1; k <= dots; k++){ const u = k / (dots + 1); if(u > pp) break; const [px, py] = pt(u); ctx.fillStyle = "#fff"; ctx.strokeStyle = P.navy; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.arc(px, py, 13 * s, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    const p2 = easeBack(prog(t, 1.7, .4)); if(p2 > 0){
      ctx.save(); ctx.globalAlpha = clamp(p2); const bx = x + w - bw - 10 * s, by = ey + 10 * s;
      ctx.fillStyle = P.red; rr(ctx, bx, by, bw + 10 * s, bh, 6 * s); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)"; font(ctx, 16 * s, 800); spaced(ctx, String(d.ust2 || "SON ADIM").toLocaleUpperCase("tr"), bx + 24 * s, by + 34 * s, 3 * s);
      ctx.fillStyle = "#fff"; fitText(ctx, d.son || "", bw - 30 * s, 34 * s, 800); ctx.fillText(d.son || "", bx + 24 * s, by + 74 * s); ctx.restore();
    }
    if(d.alt){ const p3 = easeOut(prog(t, 2.1, .4)); if(p3 > 0){ ctx.save(); ctx.globalAlpha = p3; const by = ey + bh + 50 * s; ctx.fillStyle = P.navy; ctx.fillRect(x, by, w * p3, 70 * s); ctx.fillStyle = P.red; ctx.fillRect(x, by + 66 * s, w * p3, 4 * s);
      icon(ctx, "shield", x + 40 * s, by + 35 * s, 18 * s, "#fff"); ctx.fillStyle = "#fff"; fitText(ctx, d.alt, w - 110 * s, 26 * s, 800); ctx.textBaseline = "middle"; ctx.fillText(d.alt, x + 74 * s, by + 36 * s); ctx.restore(); } }
  },
  // Buyuyen faz sutunlari
  fazlar(ctx, L, t, P, d){
    const {x, w, s} = L; const y = header(ctx, L, t, P, d);
    const items = (d.items || [{label: "Bugün"}, {label: "Faz 1"}, {label: "Faz 2"}, {label: "Faz 3"}]).slice(0, 5); const n = items.length;
    const gap = 16 * s, bw = (w - gap * (n - 1)) / n, base = y + 560 * s;
    items.forEach((it, i) => {
      const p = easeOut(prog(t, .45 + i * .3, .5)); if(p <= 0) return;
      const h = (110 + i * (400 / Math.max(1, n - 1))) * s * p, bx = x + i * (bw + gap), last = i === n - 1;
      ctx.save(); ctx.fillStyle = last ? P.navy : "#ffffff"; ctx.shadowColor = "rgba(20,28,60,.1)"; ctx.shadowBlur = 20 * s; ctx.fillRect(bx, base - h, bw, h); ctx.shadowBlur = 0;
      ctx.fillStyle = P.red; ctx.fillRect(bx, base - h, bw, 5 * s);
      ctx.fillStyle = last ? "rgba(255,255,255,.75)" : P.gray; font(ctx, 17 * s, 800); ctx.textBaseline = "top"; spaced(ctx, String(it.ust || "").toLocaleUpperCase("tr"), bx + 14 * s, base - h + 20 * s, 2 * s);
      ctx.fillStyle = last ? "#fff" : P.navy; fitText(ctx, it.label || "", bw - 24 * s, 28 * s, 800); ctx.fillText(it.label || "", bx + 14 * s, base - h + 44 * s); ctx.restore();
    });
  },
  // Sade baslik sahnesi: ust baslik + iki satir buyuk baslik + kirmizi cizgi
  baslik(ctx, L, t, P, d){
    const {x, w, s} = L; const y = header(ctx, {...L, y: L.y + 120 * s}, t, P, d);
    const p = easeOut(prog(t, .5, .5)); ctx.fillStyle = P.red; ctx.fillRect(x, y + 10 * s, w * .28 * p, 8 * s);
  },
  // Lacivert fonda alinti
  alinti(ctx, L, t, P, d, W, H){
    const {x, w, s} = L; const y = H * .38;
    const pe = easeOut(prog(t, .1, .4));
    ctx.save(); ctx.globalAlpha = pe; ctx.fillStyle = "rgba(255,255,255,.6)"; font(ctx, 22 * s, 800); spaced(ctx, String(d.eyebrow || "").toLocaleUpperCase("tr"), x, y, 5 * s); ctx.restore();
    const lines = [[d.title1 || "", "#ffffff", 46], [d.vurgu || "", P.red === "#111111" ? "#ffffff" : "#ff3b45", 86], [d.title2 || "", "#ffffff", 70]];
    let yy = y + 30 * s;
    lines.forEach(([txt, col, sz], i) => { if(!txt) return; const size = fitText(ctx, txt, w, sz * s, 900); yy += size * 1.08; const p = easeOut(prog(t, .3 + i * .35, .5));
      ctx.save(); ctx.beginPath(); ctx.rect(x - 10 * s, yy - size, w + 20 * s, size * 1.3); ctx.clip(); ctx.fillStyle = col; font(ctx, size, 900); ctx.fillText(txt, x, yy + size * (1 - p)); ctx.restore(); });
  },
};
export const SCENE_TYPES = Object.keys(SCENES);

function layout(W, H){
  const cw = Math.min(W * .86, H * .5); const s = cw / 680;
  return {x: (W - cw) / 2, y: H * .15, w: cw, s};
}
// Editoryal tipografi: kart, ikon, yildiz yok. Buyuk temiz yazi, ince cizgiler, buyuk rakam. (Donanim sablonundan bagimsiz dil)
// ---- Video basina konsept: yerlesim, giris hareketi, motif, boyut, tempo (yapay zeka tasarlar) ----
export const CONCEPT_OPTS = {yerlesim: ["ust", "orta", "alt", "sol"], giris: ["fade", "rise", "slide", "mask", "type"], motif: ["line", "dots", "wave", "leaf", "pulse", "circle", "frame", "none"], boyut: ["kucuk", "orta", "buyuk"], tempo: ["yavas", "orta", "canli"]};
export function pickConcept(prev = {}, ai = {}){
  const out = {};
  for(const [k, arr] of Object.entries(CONCEPT_OPTS)){ out[k] = arr.includes(ai[k]) ? ai[k] : (c => c[Math.floor(Math.random() * c.length)])(arr.filter(v => v !== prev[k])); }
  return out;
}
function motif(ctx, kind, x, y, w, s, p, col){
  if(!kind || kind === "none" || p <= 0) return;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5 * s; ctx.lineCap = "round"; ctx.globalAlpha *= .9;
  const n = 60, L = Math.floor(n * p);
  if(kind === "line"){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * p, y); ctx.stroke(); }
  else if(kind === "dots"){ for(let i = 0; i < 12 * p; i++){ ctx.beginPath(); ctx.arc(x + i * w / 12, y, 3.5 * s, 0, 7); ctx.fill(); } }
  else if(kind === "wave"){ ctx.beginPath(); for(let i = 0; i <= L; i++){ const u = i / n; ctx.lineTo(x + u * w, y + Math.sin(u * Math.PI * 4) * 10 * s); } ctx.stroke(); }
  else if(kind === "pulse"){ ctx.beginPath(); for(let i = 0; i <= L; i++){ const u = i / n, k = (u * 5) % 1; const dy = k > .4 && k < .48 ? -26 : k >= .48 && k < .56 ? 18 : 0; ctx.lineTo(x + u * w, y + dy * s); } ctx.stroke(); }
  else if(kind === "leaf"){ ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w * .5 * p, y - 18 * s, x + w * .9 * p, y - 4 * s); ctx.stroke();
    for(let i = 1; i <= 5 * p; i++){ const lx = x + i * w * .16, ly = y - 8 * s * Math.sin(i / 5 * Math.PI); ctx.beginPath(); ctx.ellipse(lx, ly - 10 * s * (i % 2 ? 1 : -1), 13 * s, 5.5 * s, (i % 2 ? -.6 : .6), 0, 7); ctx.fill(); } }
  else if(kind === "circle"){ ctx.beginPath(); ctx.arc(x + w * .82, y - 120 * s, 90 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke(); }
  else if(kind === "frame"){ const c = 26 * s * p; ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 330 * s + c); ctx.lineTo(x - 20 * s, y - 330 * s); ctx.lineTo(x - 20 * s + c, y - 330 * s); ctx.moveTo(x + w + 20 * s - c, y + 30 * s); ctx.lineTo(x + w + 20 * s, y + 30 * s); ctx.lineTo(x + w + 20 * s, y + 30 * s - c); ctx.stroke(); }
  ctx.restore();
}
function typoScene(ctx, L0, t, P, d, W, H){
  const C = STYLE.concept || {};
  const sz = C.boyut === "kucuk" ? .82 : C.boyut === "buyuk" ? 1.22 : 1;
  const L = {...L0}; if(C.yerlesim === "orta") L.y = H * .28; else if(C.yerlesim === "alt") L.y = H * .42; else if(C.yerlesim === "sol"){ L.x = W * .07; L.w = W * .62; }
  if(STYLE.ov && STYLE.face){ const f = STYLE.face;   // gercek yuz yerine gore: yuzun altina, yuz alttaysa ustune
    if(f.y1 < .56) L.y = Math.max(L.y, H * (f.y1 + .02)); else if(f.y0 > .42) L.y = H * .08; else L.y = Math.max(L.y, H * .4); }
  else if(STYLE.ov && W < H) L.y = Math.max(L.y, H * .4);   // yuz bulunamadiysa: ust-orta bolgeye yazi gelmez
  L.s = L0.s * sz;
  const ent = (p, i = 0) => { const g = C.giris || "rise"; return g === "slide" ? {dx: (1 - p) * -60 * L.s, dy: 0} : g === "fade" ? {dx: 0, dy: 0} : {dx: 0, dy: (1 - p) * 16 * L.s}; };
  const {x, w, s} = L, OV = STYLE.ov, ink = OV ? "#ffffff" : P.navy, sub = OV ? "rgba(255,255,255,.8)" : P.gray;
  const center = STYLE.align === "center", ax = center ? x + w / 2 : x;
  const items = (d.items || []).map(i => typeof i === "string" ? i : (i.label || "")).filter(Boolean);
  if(!items.length){ if(d.bas) items.push(d.bas); if(d.son) items.push(d.son); if(d.label && !d.adet) items.push(d.label); if(d.alt) items.push(d.alt); }
  const stroke = (txt, xx, yy) => { if(OV){ ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = Math.max(2, parseInt(ctx.font.match(/(\d+)px/)[1]) * .07); ctx.lineJoin = "round"; ctx.strokeText(txt, xx, yy); } ctx.fillText(txt, xx, yy); };
  ctx.save(); ctx.textAlign = center ? "center" : "left"; ctx.textBaseline = "alphabetic";
  let y = L.y + 40 * s;
  const pe = easeOut(prog(t, .05, .4));
  ctx.globalAlpha = pe; ctx.fillStyle = OV ? "#ffffff" : P.red; font(ctx, 22 * s, 700); ctx.fillText(String(d.eyebrow || "").toLocaleUpperCase("tr").split("").join(" "), ax, y);
  ctx.globalAlpha = pe; ctx.fillStyle = OV ? "#ffffff" : P.red; ctx.fillRect(center ? ax - 20 * s : ax, y + 18 * s, 40 * s * pe, 3 * s);
  y += 90 * s;
  [[d.title1, ink, 74], [d.title2, OV ? "#ffffff" : P.red, 74]].forEach(([txt, col, sz], i) => { if(!txt) return;
    const size = fitText(ctx, txt, w, sz * s, 800), p = easeOut(prog(t, .12 + i * .12, .5)), e = ent(p);
    let shown = txt; if(C.giris === "type") shown = txt.slice(0, Math.ceil(txt.length * clamp(prog(t, .12 + i * .25, .9))));
    ctx.globalAlpha = C.giris === "mask" || C.giris === "type" ? 1 : p; ctx.fillStyle = col; font(ctx, size, 800);
    if(C.giris === "mask"){ ctx.save(); ctx.beginPath(); ctx.rect(center ? ax - w / 2 : ax - 10 * s, y - size, w + 20 * s, size * 1.25); ctx.clip(); stroke(txt, ax, y + (1 - p) * size); ctx.restore(); }
    else if(shown) stroke(shown, ax + e.dx, y + e.dy);
    y += size * 1.12; });
  motif(ctx, C.motif, center ? ax - w / 2 : ax, y + 4 * s, w, s, easeOut(prog(t, .35, 1.2)), OV ? "rgba(255,255,255,.85)" : P.red);
  if(C.motif && C.motif !== "none") y += 26 * s;
  if(d.adet && !items.length){ const p = easeOut(prog(t, .45, .6)), n = Math.round((parseInt(d.adet) || 0) * p);
    ctx.globalAlpha = p; ctx.fillStyle = OV ? "#ffffff" : P.red; font(ctx, 220 * s, 300); stroke(String(n), ax, y + 200 * s);
    if(d.label){ ctx.fillStyle = sub; font(ctx, 30 * s, 600); stroke(String(d.label), ax, y + 250 * s); } ctx.restore(); return; }
  y += 30 * s;
  items.slice(0, 5).forEach((it, i) => {
    const p = easeOut(prog(t, .45 + i * .35, .55)); if(p <= 0) return;
    const last = i === Math.min(items.length, 5) - 1, size = fitText(ctx, it, w, 44 * s, last ? 800 : 600);
    const e = ent(p, i);
    ctx.globalAlpha = p; ctx.fillStyle = OV ? "rgba(255,255,255,.5)" : P.line; ctx.fillRect(center ? ax - w / 2 : ax, y, w * p, 1.5 * s);
    ctx.fillStyle = last ? (OV ? "#ffffff" : P.red) : ink; font(ctx, size, last ? 800 : 600);
    const shownIt = C.giris === "type" ? it.slice(0, Math.ceil(it.length * p)) : it;
    stroke(shownIt, ax + e.dx, y + 30 * s + size * .9 + e.dy);
    y += size + 60 * s;
  });
  ctx.restore();
}
function drawScene(ctx, W, H, sc, t, P){
  const dark = sc.type === "alinti";
  STYLE.ov = !!sc.ov;
  if(sc.ov){ ctx.clearRect(0, 0, W, H); const fn = STYLE.typo && sc.type !== "alinti" ? typoScene : (SCENES[sc.type] || SCENES.kartlar); try{ fn(ctx, layout(W, H), t, P, sc, W, H); }catch(e){} STYLE.ov = false; return; }
  background(ctx, W, H, t, P, dark);
  const fn = STYLE.typo && !dark ? typoScene : (SCENES[sc.type] || SCENES.kartlar);
  try{ fn(ctx, layout(W, H), t, P, sc, W, H); }catch(e){}
  wipe(ctx, W, H, t, P);
}

// ---------- altyazi + isim etiketi (ASS) ----------
const assT = t => { t = Math.max(0, t); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return h + ":" + String(m).padStart(2, "0") + ":" + s.toFixed(2).padStart(5, "0"); };
const esc = t => String(t).replace(/[{}\\]/g, "").trim();
const hex2ass = (h, a = "00") => { h = h.replace("#", ""); return "&H" + a + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };
function inScene(t, scenes){ return scenes.some(sc => t >= sc.start && t < sc.end); }
export function buildCaptions(words, plan, W, H, P){
  const s = Math.min(W, H) / 1080, fs = Math.round(62 * s), y = Math.round(H * (W < H ? .73 : .86));
  const emph = new Set(plan.vurgu || []);
  const L = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: " + W, "PlayResY: " + H, "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]", "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Secondary tamamen saydam: kelimeler soylendikce belirir
    "Style: Cap,Montserrat ExtraBold," + fs + ",&H00FFFFFF,&HFF000000,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,0," + Math.round(4 * s) + ",5,40,40,0,1",
    "Style: CapD,Montserrat ExtraBold," + fs + "," + hex2ass(P.navy) + ",&HFF000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1",
    "Style: LT,Montserrat ExtraBold," + Math.round(44 * s) + "," + hex2ass(P.navy) + "," + hex2ass(P.navy) + ",&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
    "Style: LT2,Montserrat ExtraBold," + Math.round(20 * s) + "," + hex2ass(P.navy) + "," + hex2ass(P.navy) + ",&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,7,0,0,0,1",
    "Style: Box,Montserrat ExtraBold,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1", "",
    "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"];
  // 1-3 kelimelik parcalar, soylendikce kelime kelime
  const groups = []; let cur = [];
  words.forEach((w, i) => { cur.push({...w, i}); const nx = words[i + 1]; if(cur.length >= 3 || /[.,!?;:…]$/.test(w.w) || !nx || nx.s - w.e > .3){ groups.push(cur); cur = []; } });
  for(const g of groups){
    const st = g[0].s, en = Math.min(g[g.length - 1].e + .35, (g[g.length - 1].e + 1.2));
    const dark = inScene(st + .05, plan.sahneler || []);
    let txt = "{\\an5\\pos(" + Math.round(W / 2) + "," + y + ")\\fad(60,80)}"; let tt = st;
    for(const w of g){
      const gap = Math.max(0, Math.round((w.s - tt) * 100)), dur = Math.max(1, Math.round((w.e - w.s) * 100)); tt = w.e;
      const word = esc(w.w);
      txt += (gap ? "{\\k" + gap + "}" : "") + (emph.has(w.i) ? "{\\k" + dur + "\\c" + hex2ass(dark ? P.red : "#ffffff") + "&\\3c" + hex2ass(P.navy) + "&\\bord" + Math.round(10 * s) + "}" + word + "{\\bord0\\c" + (dark ? hex2ass(P.navy) : "&H00FFFFFF") + "&}" : "{\\k" + dur + "}" + word) + " ";
    }
    L.push("Dialogue: 3," + assT(st) + "," + assT(en) + "," + (dark ? "CapD" : "Cap") + ",,0,0,0,," + txt.trim());
  }
  // isim etiketi
  const it = plan.isim;
  if(it && it.ad){
    const a = +(it.start || 0.5), b = +(it.end || a + 4.5), bx = Math.round(W * .06), by = Math.round(H * (W < H ? .6 : .72)), bw = Math.round(Math.min(W * .62, 560 * s)), bh = Math.round(96 * s);
    L.push("Dialogue: 4," + assT(a) + "," + assT(b) + ",Box,,0,0,0,,{\\an7\\p1\\c&HFFFFFF&\\fad(0,200)\\move(" + (-bw) + "," + by + "," + bx + "," + by + ",0,350)}m 0 0 l " + bw + " 0 " + bw + " " + bh + " 0 " + bh + "{\\p0}");
    L.push("Dialogue: 5," + assT(a) + "," + assT(b) + ",Box,,0,0,0,,{\\an7\\p1\\c" + hex2ass(P.red) + "&\\fad(0,200)\\move(" + (-bw) + "," + by + "," + bx + "," + by + ",0,350)}m 0 0 l " + Math.round(7 * s) + " 0 " + Math.round(7 * s) + " " + (bh + Math.round(26 * s)) + " 0 " + (bh + Math.round(26 * s)) + "{\\p0}");
    L.push("Dialogue: 5," + assT(a + .2) + "," + assT(b) + ",LT,,0,0,0,,{\\an7\\fad(150,200)\\pos(" + (bx + Math.round(26 * s)) + "," + (by + Math.round(14 * s)) + ")}" + esc(it.ad));
    if(it.unvan){ L.push("Dialogue: 4," + assT(a + .3) + "," + assT(b) + ",Box,,0,0,0,,{\\an7\\p1\\c" + hex2ass(P.navy) + "&\\fad(150,200)\\pos(" + bx + "," + (by + bh) + ")}m 0 0 l " + Math.round(bw * .62) + " 0 " + Math.round(bw * .62) + " " + Math.round(30 * s) + " 0 " + Math.round(30 * s) + "{\\p0}");
      L.push("Dialogue: 5," + assT(a + .35) + "," + assT(b) + ",LT2,,0,0,0,,{\\an7\\c&HFFFFFF&\\fad(150,200)\\pos(" + (bx + Math.round(22 * s)) + "," + (by + bh + Math.round(4 * s)) + ")}" + esc(it.unvan)); }
  }
  return L.join("\n") + "\n";
}

// ---------- ana fonksiyon ----------
export async function renderMotion({ff, input, W, H, words, plan, palette = "kurumsal", onStep = () => {}, fontTTF}){
  const P = PALETTES[palette] || PALETTES.kurumsal;
  await loadFonts();
  const scenes = (plan.sahneler || []).filter(sc => SCENES[sc.type] && +sc.end > +sc.start).map(sc => ({...sc, start: +sc.start, end: +sc.end})).sort((a, b) => a.start - b.start).slice(0, 14);
  plan.sahneler = scenes;
  // 1) sahneleri kare kare ciz -> JPEG
  const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), {width: W, height: H});
  const ctx = cv.getContext("2d");
  const total = scenes.reduce((a, sc) => a + Math.ceil((sc.end - sc.start) * FPS), 0); let done = 0;
  for(let k = 0; k < scenes.length; k++){
    const sc = scenes[k], n = Math.ceil((sc.end - sc.start) * FPS);
    await ff.createDir("s" + k).catch(() => {});
    for(let f = 0; f < n; f++){
      drawScene(ctx, W, H, sc, f / FPS, P);
      const blob = cv.convertToBlob ? await cv.convertToBlob({type: "image/jpeg", quality: .9}) : await new Promise(r => cv.toBlob(r, "image/jpeg", .9));
      await ff.writeFile("s" + k + "/f" + String(f).padStart(4, "0") + ".jpg", new Uint8Array(await blob.arrayBuffer()));
      if(++done % 15 === 0) onStep("Sahneler çiziliyor… %" + Math.round(done / total * 100));
    }
  }
  // 2) altyazi + isim etiketi
  const ass = buildCaptions(words, plan, W, H, P);
  await ff.createDir("/fonts").catch(() => {});
  if(fontTTF) await ff.writeFile("/fonts/Montserrat-ExtraBold.ttf", fontTTF);
  await ff.writeFile("motion.ass", new TextEncoder().encode(ass));
  // 3) birlestir: sahneler tam ekran (fade), ses devam eder, en ustte altyazi
  const args = ["-hide_banner", "-y", "-i", input];
  scenes.forEach((sc, k) => args.push("-framerate", String(FPS), "-i", "s" + k + "/f%04d.jpg"));
  let fc = "[0:v]scale=" + W + ":" + H + ":force_original_aspect_ratio=increase,crop=" + W + ":" + H + ",setsar=1,fps=" + FPS + "[b0]";
  scenes.forEach((sc, k) => {
    const d = (sc.end - sc.start).toFixed(3);
    fc += ";[" + (k + 1) + ":v]format=yuva420p,fade=t=out:st=" + Math.max(0, d - .25).toFixed(3) + ":d=0.25:alpha=1,setpts=PTS-STARTPTS+" + sc.start.toFixed(3) + "/TB[o" + k + "]";
    fc += ";[b" + k + "][o" + k + "]overlay=eof_action=pass:enable='between(t," + sc.start.toFixed(3) + "," + sc.end.toFixed(3) + ")'[b" + (k + 1) + "]";
  });
  fc += ";[b" + scenes.length + "]ass=motion.ass:fontsdir=/fonts,format=yuv420p[v]";
  args.push("-filter_complex", fc, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "out.mp4");
  return {args, ass, scenes};
}

let fontsLoaded = false;
async function loadFonts(){
  if(fontsLoaded) return;
  for(const w of [800, 900]){ const f = new FontFace("Montserrat", "url(/fonts/Montserrat-" + w + ".ttf)", {weight: String(w)}); await f.load(); (self.fonts || document.fonts).add(f); }
  fontsLoaded = true;
}

// Onizleme / test icin: tek bir sahneyi verilen anda ciz
export async function previewScene(canvas, sc, t, palette = "kurumsal"){
  await loadFonts();
  drawScene(canvas.getContext("2d"), canvas.width, canvas.height, sc, t, PALETTES[palette] || PALETTES.kurumsal);
}

// ======================================================================
// HIZLI MOTOR: WebCodecs (donanim kod cozme + donanim H.264 kodlama), Mediabunny ile.
// Sahneler, altyazi ve isim etiketi ayni karede dogrudan cizilir; ses kayipsiz aktarilir.
// ======================================================================
// Altyazi gruplari: anlam bütünlüğüne göre 2-4 kelime (~24 harf); "ve, bir, için, de…" gibi bağlayıcılarda satır bitmez
const NOEND = /^(ve|veya|ile|bir|bu|şu|o|için|gibi|kadar|de|da|ki|ama|çünkü|en|daha|çok|her|hem|ne|ya|yani|the|a)$/i;
function captionGroups(words){
  const groups = []; let cur = [];
  words.forEach((w, i) => { cur.push({...w, i}); const nx = words[i + 1], len = cur.reduce((a, x) => a + x.w.length + 1, 0);
    const hard = /[.!?…]$/.test(w.w) || !nx || nx.s - w.e > .35, soft = /[,;:]$/.test(w.w);
    const full = cur.length >= 4 || len + (nx ? nx.w.length : 0) > 24;
    if(hard || ((soft || full) && !((NOEND.test(w.w.replace(/[.,!?;:…]+$/, "")) || /^%?\d[\d.,]*%?$/.test(w.w)) && cur.length < 5 && nx && nx.s - w.e < .35))){ groups.push(cur); cur = []; } });
  // tek kelime kalan grubu (yakinsa) oncekine ekle
  for(let g = groups.length - 1; g > 0; g--){ const a = groups[g - 1], b = groups[g];
    if(b.length === 1 && b[0].s - a[a.length - 1].e < .4 && a.concat(b).reduce((x, w) => x + w.w.length + 1, 0) <= 30 && !/[.!?…]$/.test(a[a.length - 1].w)){ groups.splice(g - 1, 2, a.concat(b)); } }
  return groups.map(g => ({words: g, st: g[0].s, en: Math.min(g[g.length - 1].e + .35, g[g.length - 1].e + 1.2)}));
}
// Glow Up altyazi: beyaz kalin sans + ince koyu kontur, anahtar kelime duz marka renginde keskin kutu,
// giris yalniz opaklik + 14px kayma; alt kenar <= y1470 (1920'de), sag dugme sutunu bos.
function drawCaptionGlow(ctx, W, H, t, groups, emph, P, onScene){
  if(onScene) return;
  const g = groups.find(x => t >= x.st && t < x.en); if(!g) return;
  const s = Math.min(W, H) / 1080, vert = W < H, fs = (vert ? 64 : 56) * s;
  const bottom = vert ? H * (1470 / 1920) : H * .9, cx = vert ? W * .47 : W / 2, maxW = vert ? W * .78 : W * .8;
  const txt = w => { const x = w.w.replace(/[{}\\]/g, ""); return STYLE.lower ? x : x; };
  font(ctx, fs, 800);
  const sp = ctx.measureText(" ").width;
  let parts = g.words.map(w => ({w, t: txt(w), wd: ctx.measureText(txt(w)).width}));
  const total = parts.reduce((a, p) => a + p.wd, 0) + sp * (parts.length - 1);
  const k = Math.min(1, maxW / total), f2 = fs * k; font(ctx, f2, 800);
  parts = parts.map(p => ({...p, wd: p.wd * k}));
  const y = bottom - f2 * .75;
  const pad = 14 * s, nEm = STYLE.nobox ? 0 : parts.filter(p => emph.has(p.w.i)).length;
  let x = cx - (total * k + nEm * pad * 2) / 2;
  const out = easeOut(clamp((g.en - t) / .22));
  ctx.save(); ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.lineJoin = "round";
  for(const p of parts){
    const a = easeOut(clamp((t - p.w.s + .06) / .28));
    if(a > 0){
      const dy = (1 - a) * 10 * s, em = emph.has(p.w.i) && !STYLE.nobox; if(em) x += pad;
      ctx.globalAlpha = a * out;
      if(em){ ctx.fillStyle = P.red; ctx.fillRect(x - 10 * s, y - f2 * .62 + dy, p.wd + 20 * s, f2 * 1.2); }
      else { ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = Math.max(2, f2 * .09); ctx.strokeText(p.t, x, y + dy); }
      ctx.fillStyle = em && /^#?(f|e|d)[0-9a-f]/i.test(P.red.replace("#", "")) ? "#111111" : "#ffffff";
      ctx.fillText(p.t, x, y + dy);
    }
    x += p.wd + sp * k + (emph.has(p.w.i) && !STYLE.nobox ? (a > 0 ? pad : pad * 2) : 0);
  }
  ctx.restore();
}
// Dolgu sesleri ("eee", "ıı", "hmm") altyazidan cikar; kesin yazim hatalarini duzelt (TDK).
const FILLER = /^(e{2,}|ı{2,}|i{3,}|a{3,}|h?m{2,}|hı+m*|ee+h|ıh+|eh+)[.,…]*$/i;
const FIX = {"herşey": "her şey", "birşey": "bir şey", "hiçbirşey": "hiçbir şey", "yada": "ya da", "şuan": "şu an", "herkez": "herkes", "birsürü": "bir sürü", "yanlız": "yalnız", "birkere": "bir kere", "pekçok": "pek çok"};
export function cleanWords(words){
  const fixed = [];
  const out = words.filter(w => !FILLER.test(w.w.trim())).map(w => {
    const m = w.w.match(/^(.*?)([.,!?;:…]*)$/); const key = m[1].toLocaleLowerCase("tr");
    if(FIX[key]){ fixed.push(m[1] + " → " + FIX[key]); return {...w, w: (m[1][0] === m[1][0].toLocaleUpperCase("tr") ? FIX[key][0].toLocaleUpperCase("tr") + FIX[key].slice(1) : FIX[key]) + m[2]}; }
    return w;
  });
  return {words: out, removed: words.length - out.length, fixed};
}
// TDK de/da kontrol listesi: ayri "de/da" ve "-de/-da" ile biten kelimeler zaman koduyla (insan gozuyle teyit icin).
export function tdkReport(words){
  const tc = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  return words.filter(w => /^(de|da|[\p{L}]{2,}(de|da|te|ta))[.,!?…]*$/iu.test(w.w)).slice(0, 40).map(w => tc(w.s) + " " + w.w);
}
// Google Fonts'tan marka fontunu yukle (latin + latin-ext; Turkce karakterler dahil).
async function loadBrandFont(name, italic){
  if(!name || name === "Montserrat") return;
  try{
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=" + encodeURIComponent(name) + ":" + (italic ? "ital,wght@1,600;1,800;1,900" : "wght@600;800;900") + "&display=swap")).text();
    const rx = /\/\* ([\w-]+) \*\/\s*@font-face\s*{([^}]+)}/g; let m; const jobs = [];
    while((m = rx.exec(css))){
      if(!/^latin/.test(m[1])) continue;
      const b = m[2], url = (b.match(/url\(([^)]+)\)/) || [])[1], w = (b.match(/font-weight:\s*(\d+)/) || [])[1], ur = (b.match(/unicode-range:\s*([^;]+)/) || [])[1];
      if(url){ const f = new FontFace(name, "url(" + url + ")", {weight: w || "800", style: italic ? "italic" : "normal", unicodeRange: ur}); jobs.push(f.load().then(x => (self.fonts || document.fonts).add(x))); }
    }
    await Promise.all(jobs);
  }catch(e){ console.warn("Marka fontu yüklenemedi:", e); }
}
function drawCaption(ctx, W, H, t, groups, emph, P, onScene){
  if(STYLE.noCaps) return;
  if(STYLE.capColor && !STYLE.__cc){ const f = ctx.fillText.bind(ctx); STYLE.__cc = 1; ctx.fillText = function(txt, x, y, m){ if(this.fillStyle === "#ffffff") this.fillStyle = STYLE.capColor; return m === undefined ? f(txt, x, y) : f(txt, x, y, m); }; }
  if(STYLE.glow || STYLE.cap === "glide") return drawCaptionGlow(ctx, W, H, t, groups, emph, P, onScene);
  if(STYLE.cap === "highlight" || STYLE.cap === "spotlight"){
    // Profesyonel kurgucularin stili: 2-5 kelime, kalin beyaz + ince kontur; aktif kelimenin arkasinda renkli kutu kelimeden kelimeye yumusakca kayar (highlight)
    // ya da aktif kelime parlak, digerleri soluk (spotlight)
    if(onScene) return;
    const g = groups.find(x => t >= x.st && t < x.en); if(!g) return;
    const s = Math.min(W, H) / 1080, vert = W < H, fs = 74 * s, y = capY(vert ? H * .72 : H * .85, fs, H);
    const a0 = easeOut(clamp((t - g.st + .05) / .25)) * easeOut(clamp((g.en - t) / .22));
    font(ctx, fs, 800); const sp = ctx.measureText(" ").width;
    const parts = g.words.map(w => ({w, t: w.w, wd: ctx.measureText(w.w).width}));
    const total = parts.reduce((a, p) => a + p.wd, 0) + sp * (parts.length - 1), k = Math.min(1, W * .74 / total);
    font(ctx, fs * k, 800); let x = W / 2 - total * k / 2; parts.forEach(p => { p.x = x; p.wd *= k; x += p.wd + sp * k; });
    const ci = Math.max(0, parts.findLastIndex(p => t >= p.w.s - .04)), cur = parts[ci], prev = parts[Math.max(0, ci - 1)];
    const m = easeOut(clamp((t - cur.w.s + .04) / .16)), pad = 12 * s * k;
    ctx.save(); ctx.globalAlpha = a0; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.lineJoin = "round";
    if(STYLE.cap === "highlight"){ const bx = prev.x + (cur.x - prev.x) * m, bw = prev.wd + (cur.wd - prev.wd) * m; ctx.fillStyle = P.red; rr(ctx, bx - pad, y - fs * k * .62, bw + pad * 2, fs * k * 1.22, 8 * s); ctx.fill(); }
    for(const p of parts){ const on = p === cur, said = t >= p.w.s - .04;
      ctx.globalAlpha = a0 * (STYLE.cap === "spotlight" ? (on ? 1 : said ? .7 : .4) : 1);
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = fs * k * .1; if(!(STYLE.cap === "highlight" && on)) ctx.strokeText(p.t, p.x, y);
      ctx.fillStyle = STYLE.cap === "spotlight" && on && emph.has(p.w.i) ? P.red : "#ffffff"; ctx.fillText(p.t, p.x, y); }
    ctx.restore(); return;
  }
  if(STYLE.cap === "karaoke" || STYLE.cap === "twolayer" || STYLE.cap === "left"){
    if(onScene) return;
    const g = groups.find(x => t >= x.st && t < x.en); if(!g) return;
    const s = Math.min(W, H) / 1080, vert = W < H, out = clamp((g.en - t) / .12), a0 = clamp((t - g.st) / .12) * out;
    const cur = [...g.words].reverse().find(w => t >= w.s - .03) || g.words[0];
    ctx.save(); ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    if(STYLE.cap === "twolayer"){
      const yb = capY(vert ? H * .70 : H * .82, 110 * s, H);
      font(ctx, 34 * s, 600); ctx.textAlign = "center"; ctx.globalAlpha = a0 * .9; ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 5 * s;
      const line = g.words.map(w => w.w).join(" "); ctx.strokeText(line, W / 2, yb - 70 * s, W * .84); ctx.fillText(line, W / 2, yb - 70 * s, W * .84);
      const k = clamp((t - cur.s) / .15), big = cur.w.replace(/[.,!?;:…]+$/, "").toLocaleUpperCase("tr");
      const fs = fitText(ctx, big, W * .8, 110 * s, 900); ctx.globalAlpha = out * k;
      if(emph.has(cur.i)){ const wd = ctx.measureText(big).width; ctx.fillStyle = P.red; ctx.fillRect(W / 2 - wd / 2 - 18 * s, yb - fs * .6 + (1 - k) * 18 * s, wd + 36 * s, fs * 1.2); }
      else { ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = fs * .08; ctx.strokeText(big, W / 2, yb + (1 - k) * 18 * s); }
      ctx.fillStyle = "#ffffff"; ctx.fillText(big, W / 2, yb + (1 - k) * 18 * s);
    } else {
      const fs = 58 * s, left = STYLE.cap === "left", y = capY(vert ? H * .72 : H * .85, fs, H);
      font(ctx, fs, 800); const sp = ctx.measureText(" ").width;
      const parts = g.words.map(w => ({w, t: w.w, wd: ctx.measureText(w.w).width}));
      const total = parts.reduce((a, p) => a + p.wd, 0) + sp * (parts.length - 1), k = Math.min(1, W * .74 / total);
      font(ctx, fs * k, 800); let x = left ? W * .08 + 22 * s : W / 2 - total * k / 2; ctx.textAlign = "left";
      if(left){ ctx.globalAlpha = a0; ctx.fillStyle = P.red; ctx.fillRect(W * .08, y - fs * .6, 8 * s, fs * 1.2 * clamp((t - g.st) / .2)); }
      for(const p of parts){
        const shown = t >= p.w.s - .03, on = p.w === cur;
        const a = left ? clamp((t - p.w.s + .03) / .12) : 1; if(left && a <= 0){ x += (p.wd + sp) * k; continue; }
        ctx.globalAlpha = a0 * a * (shown || left ? 1 : .45);
        ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = fs * k * .09; ctx.strokeText(p.t, x, y + (left ? (1 - a) * 12 * s : 0));
        ctx.fillStyle = (!left && on) || emph.has(p.w.i) && shown ? P.red : "#ffffff"; ctx.fillText(p.t, x, y + (left ? (1 - a) * 12 * s : 0));
        x += (p.wd + sp) * k;
      }
    }
    ctx.restore(); return;
  }
  const g = groups.find(x => t >= x.st && t < x.en); if(!g) return;
  const s = Math.min(W, H) / 1080, fs = 62 * s, y = capY(H * (W < H ? .73 : .86), fs, H);
  font(ctx, fs, 800); ctx.textBaseline = "middle";
  const vis = g.words.filter(w => t >= w.s - .03);
  if(!vis.length) return;
  const sp = ctx.measureText(" ").width;
  const parts = g.words.map(w => ({w, txt: w.w.replace(/[{}\\]/g, ""), wd: ctx.measureText(w.w).width}));
  const total = parts.reduce((a, p) => a + p.wd, 0) + sp * (parts.length - 1);
  const scale = Math.min(1, (W * .88) / total); if(scale < 1) font(ctx, fs * scale, 800);
  let x = W / 2 - total * scale / 2;
  const a = clamp((t - g.st) / .08) * clamp((g.en - t) / .1);
  ctx.save(); ctx.globalAlpha = a;
  for(const p of parts){
    const shown = t >= p.w.s - .03, wd = p.wd * scale;
    if(shown){
      const em = emph.has(p.w.i), pop = easeBack(clamp((t - p.w.s) / .18)), sc = .85 + .15 * pop;
      ctx.save(); ctx.translate(x + wd / 2, y); ctx.scale(sc, sc);
      if(em && !onScene){ ctx.fillStyle = P.navy; rr(ctx, -wd / 2 - 12 * s, -fs * .62, wd + 24 * s, fs * 1.22, 6 * s); ctx.fill(); ctx.fillStyle = P.red; ctx.fillRect(-wd / 2 - 12 * s, fs * .56, wd + 24 * s, 4 * s); }
      if(!onScene && !em){ ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 14 * s; ctx.shadowOffsetY = 3 * s; }
      ctx.fillStyle = onScene ? (em ? P.red : P.navy) : "#ffffff"; ctx.textAlign = "center"; ctx.fillText(p.txt, 0, 0);
      ctx.restore();
    }
    x += wd + sp * scale;
  }
  ctx.restore();
}
function drawLowerThird(ctx, W, H, t, it, P){
  if(!it || !it.ad) return; const a = +(it.start || .5), b = +(it.end || a + 4.5); if(t < a || t > b) return;
  const s = Math.min(W, H) / 1080, bx = W * .06, bw = Math.min(W * .62, 560 * s), bh = 96 * s, by = (STYLE.face ? faceAvoid(H * (W < H ? .6 : .72) + bh / 2, bh * 1.6, H, STYLE.face) : H * (W < H ? .6 : .72) + bh / 2) - bh / 2;
  const pin = easeOut(clamp((t - a) / .7)), pout = easeOut(clamp((b - t) / .5)), x = bx - (1 - pin) * (bw + bx);
  ctx.save(); ctx.globalAlpha = pout;
  ctx.fillStyle = "#fff"; ctx.fillRect(x, by, bw, bh); ctx.fillStyle = P.red; ctx.fillRect(x, by, 7 * s, bh + (STYLE.glow ? 30 : 26) * s);
  ctx.fillStyle = P.navy; fitText(ctx, it.ad, bw - 50 * s, 44 * s, 800); ctx.textBaseline = "middle"; ctx.fillText(it.ad, x + 26 * s, by + bh / 2 + 2 * s);
  if(it.unvan){ const p2 = easeOut(clamp((t - a - .25) / .3)); ctx.globalAlpha = pout * p2; ctx.fillStyle = P.navy; ctx.fillRect(x, by + bh, bw * .62 * p2, 30 * s); ctx.fillStyle = "#fff"; font(ctx, 19 * s, 800); ctx.fillText(it.unvan, x + 22 * s, by + bh + 15 * s); }
  ctx.restore();
}
// Sessiz boslukları kes (atlama kurgu): kelimeler arası > .55 sn boşluk kısaltılır.
export function speechSegments(words, dur){
  if(!words.length) return [[0, dur]];
  const seg = []; let a = Math.max(0, words[0].s - .2), b = words[0].e;
  for(let k = 1; k < words.length; k++){ const w = words[k]; if(w.s - b > .55){ seg.push([a, Math.min(dur, b + .15)]); a = Math.max(0, w.s - .12); } b = Math.max(b, w.e); }
  seg.push([a, Math.min(dur, b + .45)]);
  return seg.filter(x => x[1] - x[0] > .05);
}
// Kullanicinin yazdigi ek talimatlar: "ilk 5 sn kes", "son 3 saniyeyi sil", "sarı altyazı", "büyük harf", "altyazı olmasın"
export function parseWishes(q){
  q = String(q || "").toLocaleLowerCase("tr");
  const num = rx => { const m = q.match(rx); return m ? parseFloat(m[1].replace(",", ".")) : 0; };
  const colors = {sarı: "#ffd400", beyaz: "#ffffff", kırmızı: "#ff3b30", yeşil: "#34c759", mavi: "#4da3ff", turuncu: "#ff9f0a", pembe: "#ff5fa2"};
  const ck = Object.keys(colors).find(k => new RegExp(k + "\\s*(renkli\\s*)?alt ?yazı").test(q) || new RegExp("alt ?yazı(lar)?\\s*(rengi\\s*)?" + k).test(q));
  return {
    trimStart: num(/ilk\s*(\d+(?:[.,]\d+)?)\s*(?:sn|saniye)/), trimEnd: num(/son\s*(\d+(?:[.,]\d+)?)\s*(?:sn|saniye)/),
    capColor: ck ? colors[ck] : "", upper: /büyük harf/.test(q),
    loud: /ses(i)? (yükselt|arttır|artır|dengele|düzelt|normalize|güçlendir)|ses (kısık|düşük|az)|sesi aç/.test(q),
    grade: /siyah ?beyaz|black ?white/.test(q) ? "grayscale(1) contrast(1.1)" : /sinematik renk|film gibi renk|sinematik ton/.test(q) ? "contrast(1.1) saturate(.9) brightness(.98) sepia(.06)" : /sıcak ton|sıcak renk|sıcak yap/.test(q) ? "sepia(.14) saturate(1.12) contrast(1.04)" : /soğuk ton|soğuk renk/.test(q) ? "hue-rotate(-8deg) saturate(.95) contrast(1.05) brightness(1.02)" : /canlı renk|renkleri canlandır|renk(leri)? (düzelt|iyileştir|ayarla)/.test(q) ? "contrast(1.07) saturate(1.18) brightness(1.02)" : "", noCaps: /alt ?yazı (olmasın|yok|istemiyorum|ekleme)|altyazısız/.test(q),
    level: /sade kurgu|sakin kurgu|efekt(siz| olmasın| yok)|minimal kurgu/.test(q) ? "sade" : /dinamik|enerjik|viral|hareketli|after ?effects?|claude gibi|efektli|tiktok tarz|reels tarz|hızlı kurgu|profesyonel kurgu/.test(q) ? "dinamik" : "",
    sfx: /ses efekti (olmasın|yok|istemiyorum)|efekt sesi (olmasın|yok)|sfx (olmasın|yok)/.test(q) ? false : /ses efekt|efekt ses|whoosh|sfx/.test(q) ? true : undefined,
    noTrans: /geçiş (efekti )?(olmasın|yok|istemiyorum)|geçişsiz/.test(q),
  };
}
// ======================================================================
// KURGU MOTORU (After Effects / profesyonel kurgucu tarzi): yuz algilama, kamera (punch-in, sarsinti,
// hareket bulanikligi), kesme noktalarinda gecisler (whip, zoom bulaniklik, glitch, flas) ve koddan
// uretilen ses efektleri. Her sey zamanin saf fonksiyonu; rastgelelik tohumlu (ayni video = ayni kurgu).
// ======================================================================
const hsh = (i, s = 1) => { let a = (i * 374761393 + s * 668265263) | 0; a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61); return ((a ^ (a >>> 14)) >>> 0) / 4294967296; };
const noise1 = (x, s = 1) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hsh(i, s) * (1 - u) + hsh(i + 1, s) * u) * 2 - 1; };
const easeIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// Yuz algilama (MediaPipe BlazeFace, Apache 2.0, siteye gomulu): videodan 9 kare orneklenir, en buyuk yuzun
// ortanca kutusu doner (cikti karesine gore 0-1). Bulunamazsa null; hata olursa sessizce null (eski sabit kural).
export async function detectFace(MB, vt, dur, W, H, onStep = () => {}){
  try{
    onStep("Yüz aranıyor (yazılar yüze gelmesin)…");
    const V = await import("/vendor/mediapipe/vision_bundle.mjs");
    const files = await V.FilesetResolver.forVisionTasks("/vendor/mediapipe/wasm");
    const det = await V.FaceDetector.createFromOptions(files, {baseOptions: {modelAssetPath: "/vendor/mediapipe/blaze_face_short_range.tflite"}, runningMode: "IMAGE", minDetectionConfidence: .55});
    const sw = 360, sh = Math.round(360 * H / W);
    const sink = new MB.CanvasSink(vt, {width: sw, height: sh, fit: "cover", poolSize: 1});
    const ts = Array.from({length: 9}, (_, i) => Math.max(0, dur * (i + .5) / 9));
    const boxes = [];
    for await (const wc of sink.canvasesAtTimestamps(ts)){
      if(!wc) continue;
      const img = wc.canvas.getContext("2d").getImageData(0, 0, sw, sh);
      const r = det.detect(img); const d = (r.detections || []).map(x => x.boundingBox).sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if(d && d.width > sw * .06) boxes.push([d.originX / sw, d.originY / sh, (d.originX + d.width) / sw, (d.originY + d.height) / sh]);
    }
    det.close();
    if(boxes.length < 3) return null;
    const med = k => boxes.map(b => b[k]).sort((a, b) => a - b)[Math.floor(boxes.length / 2)];
    let [x0, y0, x1, y1] = [0, 1, 2, 3].map(med); const fw = x1 - x0, fh = y1 - y0;
    // yuz kutusu yalniz yuzu kapsar: sac/alin ve cene/boyun payi ekle
    x0 -= fw * .18; x1 += fw * .18; y0 -= fh * .45; y1 += fh * .22;
    return {x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(1, x1), y1: Math.min(1, y1), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + fh * .05, n: boxes.length};
  }catch(e){ console.warn("Yüz algılanamadı:", e); return null; }
}
// Yazi bandi yuzle cakisiyorsa en yakin bos yere tasi (alt sinir Reels guvenli alani)
function faceAvoid(y, h, H, face, lo = .1, hi = .765){
  if(!face) return y;
  const pad = H * .025, f0 = face.y0 * H - pad, f1 = face.y1 * H + pad;
  if(y + h / 2 < f0 || y - h / 2 > f1) return y;
  const below = f1 + h / 2, above = f0 - h / 2;
  const okB = below + h / 2 <= H * hi, okA = above - h / 2 >= H * lo;
  if(okB && okA) return Math.abs(below - y) <= Math.abs(above - y) ? below : above;
  return okB ? below : okA ? above : y;
}
const capY = (y, fs, H) => STYLE.face ? faceAvoid(y, fs * 1.5, H, STYLE.face, .1, .78) : y;

// Kurgu plani: konusma, vurgular ve kesme noktalarindan; yapay zekanin ozel olaylari (plan.kurgu.olaylar) once gelir.
export const KURGU_TIPLER = ["punch", "shake", "whip", "zoomblur", "glitch", "flash"];
export function planEdits({words, groups, emph, cuts = [], dur, level = "orta", ai = [], brand = false, sfx = false}){
  const L = brand ? "sade" : level, out = {punch: [], shake: [], trans: [], sfx: [], intro: L !== "sade", level: L};
  const gap = L === "dinamik" ? 1.8 : L === "orta" ? 2.6 : 4.5, amt = L === "dinamik" ? .16 : L === "orta" ? .12 : .08;
  const grpEnd = t => { const g = groups.find(x => t >= x.st - .05 && t < x.en); return g ? g.en : t + 1.2; };
  // yapay zekanin istedigi olaylar
  for(const e of (Array.isArray(ai) ? ai : [])){
    const t = +e.t; if(!(t >= 0 && t < dur)) continue;
    if(e.tip === "punch") out.punch.push({t, end: Math.min(dur, grpEnd(t)), amt});
    else if(e.tip === "shake" && !brand) out.shake.push({t, amp: L === "dinamik" ? 1 : .7, seed: Math.round(t * 100)});
    else if(["whip", "zoomblur", "glitch", "flash"].includes(e.tip) && !brand) out.trans.push({t, tip: e.tip, ai: true});
  }
  // vurgulu kelimelerde punch-in (aralik kurali: her 2-4 sn'de yeni bir sey)
  let last = out.punch.length ? -9 : -9;
  [...emph].sort((a, b) => a - b).forEach(k => { const w = words[k]; if(!w || w.s < 1.2) return;
    if(w.s - last < gap || out.punch.some(p => Math.abs(p.t - w.s) < gap * .6)) return;
    out.punch.push({t: Math.max(0, w.s - .05), end: Math.min(dur, grpEnd(w.s)), amt}); last = w.s; });
  // sarsinti: unlemli ve sayili guclu anlar (yalniz dinamik)
  if(L === "dinamik") words.forEach((w, k) => { if((/!$/.test(w.w) || (emph.has(k) && /\d/.test(w.w))) && !out.shake.some(s => Math.abs(s.t - w.s) < 3)) out.shake.push({t: w.s, amp: .8, seed: k + 11}); });
  // kesme noktalari: atlama kurgusunu gecisle ort (sade: sert kesme + zoom degisimi)
  const cyc = L === "dinamik" ? ["whip", "zoomblur", "glitch", "whip", "zoomblur"] : ["cut", "cut", "whip", "cut", "zoomblur"];
  cuts.forEach((t, i) => { if(out.trans.some(x => Math.abs(x.t - t) < .5)) return; const tip = L === "sade" ? "cut" : cyc[i % cyc.length]; out.trans.push({t, tip, cut: true}); });
  // flas en fazla 1 kez (yapisal an): dinamikte kanca bitisi
  const fl = out.trans.filter(x => x.tip === "flash"); if(fl.length > 1) fl.slice(1).forEach(x => x.tip = "zoomblur");
  out.trans.sort((a, b) => a.t - b.t);
  out.trans.forEach((x, i) => { x.d = x.tip === "glitch" ? .2 : x.tip === "flash" ? .22 : .24; x.dir = i % 2 ? -1 : 1; });
  out.punch.sort((a, b) => a.t - b.t);
  for(let i = 1; i < out.punch.length; i++) if(out.punch[i].t < out.punch[i - 1].end + .3) out.punch[i - 1].end = Math.max(out.punch[i - 1].t + .5, out.punch[i].t - .3);
  // ses efektleri: gecislerde whoosh/glitch, sarsintida darbe; kancada hafif darbe
  if(sfx && !brand){
    out.trans.forEach(x => { if(x.tip === "whip" || x.tip === "zoomblur") out.sfx.push({t: x.t + x.d * .5, k: "whoosh"}); else if(x.tip === "glitch") out.sfx.push({t: x.t, k: "glitch"}); else if(x.tip === "flash") out.sfx.push({t: x.t, k: "impact"}); });
    out.shake.forEach(s => out.sfx.push({t: s.t, k: "thud"}));
    if(L === "dinamik") out.punch.forEach(p => out.sfx.push({t: p.t, k: "tick"}));
  }
  return out;
}
// Kamera: temel kadraj ritmi x punch-in (log olcekte, sabit hizli dolly gibi) + sonumlenen gurultu sarsintisi
function camAt(t, E, base){
  let z = base, ox = 0, oy = 0, rot = 0, blur = 0, mx = 0, my = 0;
  for(const p of E.punch){ if(t < p.t || t > p.end + .35) continue;
    const k = easeOut(clamp((t - p.t) / .16)) * easeIO(clamp((p.end + .35 - t) / .35)); z *= Math.exp(Math.log(1 + p.amt) * k); }
  for(const s of E.shake){ const dt = t - s.t; if(dt < 0 || dt > .7) continue;
    const d = Math.exp(-dt / .16) * s.amp, f = 26;
    ox += noise1(dt * f, s.seed) * 16 * d; oy += noise1(dt * f, s.seed + 5) * 16 * d; rot += noise1(dt * f * .7, s.seed + 9) * .012 * d;
    mx += (noise1((dt + .01) * f, s.seed) - noise1(dt * f, s.seed)) * 16 * d * 4; my += (noise1((dt + .01) * f, s.seed + 5) - noise1(dt * f, s.seed + 5)) * 16 * d * 4; }
  if(E.intro && t < .45){ const p = easeOut(t / .45); blur = 10 * (1 - p); z *= Math.exp(Math.log(1.1) * (1 - p)); }
  return {z, ox, oy, rot, blur, mx, my};
}
function drawCam(c, src, W, H, cam, anchor, filter){
  const S = Math.min(W, H) / 1080, ax = W * anchor.x, ay = H * anchor.y;
  // tasma payi: sarsinti/donme kenari acmasin
  const over = 1 + (Math.abs(cam.ox) + Math.abs(cam.oy)) * 2.2 * S / Math.min(W, H) + Math.abs(cam.rot) * 1.4;
  const z = Math.max(1, cam.z) * over;
  // odak noktasi kenara cok yakinsa kenar acilmasin diye sinirla
  const fx = clamp(ax, W / 2 - (W / 2) * (1 - 1 / z) * 1.0, W / 2 + (W / 2) * (1 - 1 / z) * 1.0), fy = clamp(ay, H / 2 - (H / 2) * (1 - 1 / z), H / 2 + (H / 2) * (1 - 1 / z));
  const draw = (dx, dy, a) => { c.save(); c.globalAlpha = a; c.translate(fx + cam.ox * S + dx, fy + cam.oy * S + dy); c.rotate(cam.rot); c.scale(z, z); c.translate(-fx, -fy); c.drawImage(src, 0, 0, W, H); c.restore(); };
  const f = [filter, cam.blur > .4 ? "blur(" + (cam.blur * S).toFixed(1) + "px)" : ""].filter(Boolean).join(" ");
  if(f) c.filter = f;
  const mv = Math.hypot(cam.mx, cam.my) * S;
  if(mv > 2){ const n = 5; for(let k = 0; k < n; k++){ const u = k / (n - 1) - .5; draw(cam.mx * S * u, cam.my * S * u, k ? 1 / (k + 1) : 1); } }   // hareket bulanikligi (alt kare ortalamasi)
  else draw(0, 0, 1);
  c.filter = "none";
}
// Gecisler: A (kesmeden onceki son kare) ve B (yeni goruntu) ayni anda ekranda; bos kare yok
function blurStrip(c, img, x, y, w, h, dx, dy, n){ for(let k = 0; k < n; k++){ const u = n > 1 ? k / (n - 1) - .5 : 0; c.globalAlpha = k ? 1 / (k + 1) : 1; c.drawImage(img, x + dx * u, y + dy * u, w, h); } c.globalAlpha = 1; }
function drawTransition(c, tr, p, A, B, W, H, tmp, frameNo){
  const S = Math.min(W, H) / 1080;
  if(tr.tip === "whip"){
    const e = easeIO(p), sp = Math.sin(Math.PI * p) * W * .35, d = tr.dir;
    blurStrip(c, A, -d * W * e, 0, W, H, sp, 0, 7); blurStrip(c, B, d * W * (1 - e), 0, W, H, sp, 0, 7);
  } else if(tr.tip === "zoomblur"){
    const e = easeOut(p), s = Math.exp(Math.log(1.35) * (1 - e));
    if(p < .45){ c.globalAlpha = 1; const sa = 1 + .4 * p; c.drawImage(A, W / 2 - W * sa / 2, H / 2 - H * sa / 2, W * sa, H * sa); }
    const n = 6; for(let k = 0; k < n; k++){ const sk = s * (1 + .05 * k * (1 - e)); c.globalAlpha = (k ? 1 / (k + 1) : 1) * (p < .45 ? clamp(p / .25) : 1); c.drawImage(B, W / 2 - W * sk / 2, H * .45 - H * sk * .45, W * sk, H * sk); }
    c.globalAlpha = 1;
  } else if(tr.tip === "glitch"){
    const src = p < .45 && frameNo % 2 ? A : B, amp = (1 - p) * W * .07;
    // renk kaymasi (kirmizi kanal ayri): tmp[0] = yalniz kirmizi, tmp[1] = camgobegi
    const [r, g] = tmp; const rc = r.getContext("2d"), gc = g.getContext("2d");
    rc.globalCompositeOperation = "source-over"; rc.drawImage(src, 0, 0, W, H); rc.globalCompositeOperation = "multiply"; rc.fillStyle = "#ff0000"; rc.fillRect(0, 0, W, H); rc.globalCompositeOperation = "source-over";
    gc.globalCompositeOperation = "source-over"; gc.drawImage(src, 0, 0, W, H); gc.globalCompositeOperation = "multiply"; gc.fillStyle = "#00ffff"; gc.fillRect(0, 0, W, H); gc.globalCompositeOperation = "source-over";
    c.drawImage(g, 0, 0); c.globalCompositeOperation = "lighter"; c.drawImage(r, amp * .35, 0); c.globalCompositeOperation = "source-over";
    // yatay serit kaymasi
    for(let k = 0; k < 7; k++){ const hh = H * (.03 + hsh(k, frameNo) * .09), yy = hsh(k + 20, frameNo) * (H - hh), dx = (hsh(k + 40, frameNo) - .5) * 2 * amp; c.drawImage(src, 0, yy, W, hh, dx, yy, W, hh); }
  } else if(tr.tip === "flash"){
    c.drawImage(B, 0, 0, W, H); c.fillStyle = "#ffffff"; c.globalAlpha = Math.pow(1 - p, 2) * .85; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  } else c.drawImage(B, 0, 0, W, H);
  void S;
}
// Ses efektleri koddan uretilir (dosya/lisans yok): RBJ bant geciren ile supurulen gurultu (whoosh), alt frekans darbe, tik, glitch
function biquadBP(f0, q, sr){ const w = 2 * Math.PI * f0 / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al; return {b0: al / a0, b1: 0, b2: -al / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - al) / a0}; }
export function synthSfx(kind, sr){
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
  if(kind === "whoosh"){ const len = .42, n = Math.round(len * sr), out = new Float32Array(n); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for(let i = 0; i < n; i++){ const u = i / n, f = 350 * Math.pow(4200 / 350, Math.sin(Math.PI * u) ** 1.5), c = biquadBP(f, 1.4, sr), x = rnd();
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y * Math.pow(Math.sin(Math.PI * u), 2.2) * 1.6; }
    return {data: out, peak: .5}; }
  if(kind === "thud" || kind === "impact"){ const len = kind === "impact" ? .9 : .32, n = Math.round(len * sr), out = new Float32Array(n); let ph = 0;
    for(let i = 0; i < n; i++){ const t = i / sr, f = 95 * Math.exp(-t * 9) + 42; ph += 2 * Math.PI * f / sr; out[i] = Math.sin(ph) * Math.exp(-t * (kind === "impact" ? 4.5 : 11)) * .9 + (t < .012 ? rnd() * .5 * (1 - t / .012) : 0) + (kind === "impact" ? rnd() * .18 * Math.exp(-t * 6) : 0); }
    return {data: out, peak: 0}; }
  if(kind === "tick"){ const n = Math.round(.035 * sr), out = new Float32Array(n); for(let i = 0; i < n; i++){ const t = i / sr; out[i] = Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t * 140) * .5; } return {data: out, peak: 0}; }
  if(kind === "glitch"){ const n = Math.round(.18 * sr), out = new Float32Array(n); let hold = 0;
    for(let i = 0; i < n; i++){ if(i % 37 === 0) hold = rnd(); const t = i / sr, gate = Math.floor(t * 60) % 3 !== 1 ? 1 : 0; out[i] = (Math.round(hold * 6) / 6) * gate * .45 * Math.exp(-t * 9); } return {data: out, peak: 0}; }
  return {data: new Float32Array(0), peak: 0};
}
// Efektleri sese karistir: konusmanin ~ -18 dB altinda (sesi bastirmaz)
export function mixSfx(abuf, list){
  if(!list.length) return 0;
  const sr = abuf.sampleRate, ch = abuf.numberOfChannels; let rms = 0, n = 0; const d0 = abuf.getChannelData(0);
  for(let k = 0; k < d0.length; k += 64){ rms += d0[k] * d0[k]; n++; } rms = Math.sqrt(rms / Math.max(1, n)) || .05;
  const cache = {}; let added = 0;
  for(const e of list){ const s = cache[e.k] || (cache[e.k] = synthSfx(e.k, sr)); const g = Math.min(.5, rms * (e.k === "tick" ? 1.2 : e.k === "impact" ? 3 : 2.2));
    const i0 = Math.round((e.t - s.peak * s.data.length / sr) * sr); if(i0 >= abuf.length) continue; added++;
    for(let c = 0; c < ch; c++){ const d = abuf.getChannelData(c); for(let i = Math.max(0, -i0); i < s.data.length && i0 + i < d.length; i++) d[i0 + i] += s.data[i] * g; } }
  return added;
}
export async function renderFast({file, W, H, words, plan, palette = "kurumsal", brand = null, look = null, cut = false, zoom = true, wish = {}, onStep = () => {}}){
  // Glow Up kurallari: ham sese HIC dokunma (kazanc yalniz teklif edilir); metin yuz bolgesine (ust-orta) gelmez
  if(brand){ if(wish.loud) plan.__sesTeklif = true; wish = {...wish, loud: false}; if(plan.__concept && /ust|orta/.test(plan.__concept.yerlesim)) plan.__concept = {...plan.__concept, yerlesim: "alt"}; }
  const faceSafe = true;   // genel kural: yazi yuz/kafa bolgesine gelmez (konusmaci videolari)
  if(!brand){ const cw = cleanWords(words); words = cw.words; plan.__dolgu = cw.removed; plan.__duzeltme = cw.fixed; }   // dolgu (eee/ıı) ve kesin yazim hatalari her videoda
  if(typeof VideoEncoder === "undefined") throw new Error("NO_WEBCODECS");
  const MB = await import("/vendor/mediabunny/mediabunny.min.mjs");
  SLOW = 1.6;
  STYLE = brand ? {glow: true, font: brand.font, italic: !!brand.italic, nobox: !!brand.nobox, lower: !!brand.lower, typo: brand.id !== "donanim", concept: (plan.__concept || null)} : {};
  if(!brand && look) STYLE = {font: look.font, bg: look.bg, wipe: look.wipe, cap: look.cap, noback: look.cap !== "pop", typo: !look.cards, align: look.align, concept: look.concept};
  if(look && look.concept) SLOW = look.concept.tempo === "yavas" ? 1.9 : look.concept.tempo === "canli" ? 1.2 : 1.55;
  const P = brand ? brandPalette(brand) : look ? lookPalette(look) : (PALETTES[palette] || PALETTES.kurumsal);
  await loadFonts();
  if(!brand && look && look.font !== "Montserrat"){ onStep("Font yükleniyor (" + look.font + ")…"); await loadBrandFont(look.font); }
  if(brand){ onStep("Marka fontu yükleniyor (" + brand.font + ")…"); await loadBrandFont(brand.font, brand.italic); }
  const scenes = (plan.sahneler || []).filter(sc => SCENES[sc.type] && +sc.end > +sc.start).map(sc => ({...sc, start: +sc.start, end: +sc.end})).sort((a, b) => a.start - b.start).slice(0, 14);
  // Video surekli kesilmesin: sahneler seffaf (videonun ustunde); yalniz alinti ve "tam ekran" istenirse tam ekran.
  const full = brand ? null : (look && look.full);
  scenes.forEach(sc => { sc.ov = full === "all" ? false : sc.type !== "alinti"; });
  plan.sahneler = scenes;
  let groups = captionGroups(words); const emph = new Set(plan.vurgu || []);
  // Otomatik vurgu: yapay zeka secmediyse sayilar ve onemli uzun kelimeler (her ~3 grupta bir) vurgulanir
  if(!emph.size){ let last = -9; words.forEach((w, k) => { const c = w.w.replace(/[.,!?;:…'’]+/g, ""); if((/\d/.test(c) || c.length >= 9) && k - last > 6){ emph.add(k); last = k; } }); }
  const input = new MB.Input({source: new MB.BlobSource(file), formats: MB.ALL_FORMATS});
  const vt = await input.getPrimaryVideoTrack(); const at = await input.getPrimaryAudioTrack();
  if(!vt) throw new Error("Videoda görüntü bulunamadı.");
  const dur = await input.computeDuration();
  const face = plan.__face !== undefined ? plan.__face : await detectFace(MB, vt, dur, W, H, onStep);
  plan.__face = face; STYLE.face = face;
  const out = new OffscreenCanvas(W, H); const ctx = out.getContext("2d");
  const scv = new OffscreenCanvas(W, H); const sctx = scv.getContext("2d");
  const output = new MB.Output({format: new MB.Mp4OutputFormat({fastStart: "in-memory"}), target: new MB.BufferTarget()});
  const vsrc = new MB.CanvasSource(out, {codec: "avc", bitrate: Math.round(8.5e6 * (W * H) / (1080 * 1920)) || MB.QUALITY_HIGH, /* 1 dk 1080x1920 ~ 60-65 MB */ latencyMode: "quality", hardwareAcceleration: "prefer-hardware", keyFrameInterval: 2});
  // Akıcı hareket: kaynak 50+ fps ise 60 fps işle
  FPS = dur > 90 ? 30 : 60;  // kisa videoda 60 fps (akici grafik); uzun videoda 30 fps (yari surede biter)
  output.addVideoTrack(vsrc, {frameRate: FPS});
  // atlama kurgu: zaman eşlemesi (kaynak <-> çıkış)
  const ts0 = Math.min(dur - .5, wish.trimStart || 0), te0 = Math.max(ts0 + .5, dur - (wish.trimEnd || 0));
  if(ts0 > 0 || te0 < dur){ words = words.filter(w => w.s >= ts0 && w.e <= te0 + .1); }
  let segs = cut ? speechSegments(words, dur) : [[0, dur]];
  segs = segs.map(([a, b]) => [Math.max(a, ts0), Math.min(b, te0)]).filter(([a, b]) => b - a > .05); if(!segs.length) segs = [[ts0, te0]];
  if(wish.upper) words.forEach(w => { w.w = w.w.toLocaleUpperCase("tr"); });
  STYLE.capColor = wish.capColor || ""; STYLE.noCaps = !!wish.noCaps;
  const outDur = segs.reduce((a, x) => a + x[1] - x[0], 0), saved = dur - outDur;
  const toOut = ts => { let acc = 0; for(const [a, b] of segs){ if(ts < a) return acc; if(ts <= b) return acc + ts - a; acc += b - a; } return acc; };
  const toSrc = to => { let acc = 0; for(const [a, b] of segs){ if(to <= acc + b - a) return a + to - acc; acc += b - a; } return segs[segs.length - 1][1]; };
  if(saved > .3){
    words.forEach(w => { w.s = toOut(w.s); w.e = Math.max(w.s + .05, toOut(w.e)); });
    scenes.forEach(sc => { sc.start = toOut(sc.start); sc.end = toOut(sc.end); });
  }
  groups = captionGroups(words);
  plan.__kesilen = Math.max(0, saved);
  // Kurgu: kesme noktalari (cikti zamani) + yapay zeka olaylari + vurgular
  const cutsOut = []; { let acc = 0; segs.forEach(([a, b], k) => { if(k && a - segs[k - 1][1] > .2) cutsOut.push(acc); acc += b - a; }); }
  const KG = plan.kurgu || {};
  let level = wish.level || (["sade", "orta", "dinamik"].includes(KG.yogunluk) ? KG.yogunluk : "orta");
  if(!zoom) level = "sade";
  const aiEv = (Array.isArray(KG.olaylar) ? KG.olaylar : []).map(e => ({...e, t: saved > .3 ? toOut(+e.t) : +e.t})).filter(e => level !== "sade" || e.tip === "punch");
  const E = planEdits({words, groups, emph, cuts: wish.noTrans ? [] : cutsOut, dur: outDur, level, ai: wish.noTrans ? aiEv.filter(e => e.tip === "punch" || e.tip === "shake") : aiEv, brand: !!brand,
    sfx: !brand && wish.sfx !== false && (wish.sfx === true || (level !== "sade" && (KG.sfx === true || level === "dinamik")))});
  if(!zoom){ E.punch = []; E.shake = []; E.intro = false; }
  const cnt = {}; E.trans.forEach(x => { if(x.tip !== "cut") cnt[x.tip] = (cnt[x.tip] || 0) + 1; });
  plan.__kurgu = {seviye: E.level, punch: E.punch.length, sarsinti: E.shake.length, gecis: cnt, sfx: 0, yuz: !!face, zaman: E.trans.filter(x => x.tip !== "cut").map(x => [x.tip, +x.t.toFixed(2)]).concat(E.punch.map(x => ["punch", +x.t.toFixed(2)]), E.shake.map(x => ["shake", +x.t.toFixed(2)]))};
  let asrc = null, abuf = null;
  if(at && (saved > .3 || wish.loud || E.sfx.length)){
    try{
      const codec = await MB.getFirstEncodableAudioCodec(["aac", "opus"]);
      const ac = new OfflineAudioContext(1, 1, 48000); const src = await ac.decodeAudioData(await file.arrayBuffer());
      const sr = src.sampleRate, ch = src.numberOfChannels, len = segs.reduce((a, [x, y]) => a + Math.round((y - x) * sr), 0);
      abuf = new AudioBuffer({length: Math.max(1, len), numberOfChannels: ch, sampleRate: sr});
      const fade = Math.round(sr * .012);
      for(let c = 0; c < ch; c++){ const inp = src.getChannelData(c), outp = abuf.getChannelData(c); let o = 0;
        for(const [x, y] of segs){ const i0 = Math.round(x * sr), i1 = Math.min(inp.length, Math.round(y * sr));
          for(let k = i0; k < i1; k++){ const d = Math.min(k - i0, i1 - 1 - k); outp[o++] = inp[k] * (d < fade ? d / fade : 1); } } }
      if(wish.loud){ // istenirse konusma sesini dengele: ortalama seviye ~-18 dBFS, tepe en fazla -1 dBFS (yalniz kullanici isterse)
        let sum = 0, peak = 0, n = 0; for(let c = 0; c < ch; c++){ const d = abuf.getChannelData(c); for(let k = 0; k < d.length; k += 4){ const v = Math.abs(d[k]); sum += v * v; n++; if(v > peak) peak = v; } }
        const rms = Math.sqrt(sum / Math.max(1, n)), g = Math.min(.126 / Math.max(rms, 1e-4), .89 / Math.max(peak, 1e-4), 8);
        if(g > 1.05 || g < .95) for(let c = 0; c < ch; c++){ const d = abuf.getChannelData(c); for(let k = 0; k < d.length; k++) d[k] *= g; }
      }
      plan.__kurgu.sfx = mixSfx(abuf, E.sfx);
      if(codec){ asrc = new MB.AudioBufferSource({codec, bitrate: 160e3}); output.addAudioTrack(asrc); } else abuf = null;
    }catch(e){ console.warn("Ses kesilemedi, kesme kapatıldı:", e); abuf = null; asrc = null; }
    if(!abuf) return renderFast({file, W, H, words: words.map(w => ({...w, s: toSrc(w.s), e: toSrc(w.e)})), plan, palette, brand, look, cut: false, zoom, wish: {...wish, trimStart: 0, trimEnd: 0, loud: false}, onStep});
  } else if(at){ asrc = new MB.EncodedAudioPacketSource(at.codec); output.addAudioTrack(asrc); }
  await output.start();
  const sink = new MB.CanvasSink(vt, {width: W, height: H, fit: "cover", poolSize: 2});
  const n = Math.max(1, Math.floor(outDur * FPS));
  function* times(){ for(let i = 0; i < n; i++) yield toSrc(i / FPS); }
  // Yumuşak yeniden kadraj: her iki altyazı grubunda bir %7 içeri/dışarı, .6 sn yumuşak geçiş (pop zoom değil)
  // Kadraj ritmi (genis / orta / yakin): her altyazi grubunda (~1-2 sn) yumusak gecis; Glow Up'ta daha hafif
  const ZL = brand ? [1, 1.04, 1, 1.07] : [1, 1.06, 1.12, 1.04];
  const zoomAt = t => { if(!zoom) return 1; let k = 0; for(let g = 0; g < groups.length; g++){ if(groups[g].st <= t) k = g; else break; } const tgt = ZL[k % 4], from = ZL[(k + 3) % 4], p = easeOut(clamp((t - (groups[k] ? groups[k].st : 0)) / .9)); return from + (tgt - from) * p; };
  // Kanca basligi: ilk ~2.6 sn buyuk baslik (yapay zeka konusmadan yazar)
  const hook = String(plan.hook || "").trim().slice(0, 48);
  // Sayi animasyonu: konusmada gecen sayi ustte buyukce sayarak belirir (yalniz grafik izinliyse)
  const allowG = !(plan.__istek && plan.__istek.grafik === false) && !(wish && wish.noCaps && false);
  const NUMRX = /^(%?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?%?)$/;
  const nums = [];
  if(allowG) words.forEach((w, k) => { const c = w.w.replace(/[!?;:…]+$/, "").replace(/[.,]$/, ""); if(NUMRX.test(c) && (!nums.length || w.s - nums[nums.length - 1].s > 4) && w.s > 3){ const nx = words[k + 1] ? words[k + 1].w.replace(/[.,!?;:…]+$/, "") : ""; nums.push({s: w.s, txt: c, unit: /^(tl|lira|dolar|euro|yıl|yıllık|gün|kişi|ay|saat|dakika|km|kg|adet|bin|milyon|mühendis|ülke|şube|çeşit)/i.test(nx) ? nx : ""}); } });
  const drawNum = (t, busy) => {
    if(busy) return; const n = nums.find(x => t >= x.s - .1 && t < x.s + 1.8); if(!n) return;
    const s2 = Math.min(W, H) / 1080, p = easeOut(clamp((t - n.s + .1) / .6)), o = easeOut(clamp((n.s + 1.8 - t) / .4));
    const val = parseFloat(n.txt.replace("%", "").replace(/\.(?=\d{3})/g, "").replace(",", ".")), shown = isNaN(val) ? n.txt : n.txt.replace(/[\d.,]+/, (Math.round(val * easeOut(clamp((t - n.s + .1) / .9)) * (val % 1 ? 10 : 1)) / (val % 1 ? 10 : 1)).toLocaleString("tr-TR"));
    ctx.save(); ctx.globalAlpha = o * p; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
    font(ctx, 200 * s2, 800); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 12 * s2; const y = (face ? faceAvoid(H * .36, 260 * s2, H, STYLE.face || face) + 70 * s2 : H * (faceSafe ? .58 : .3)) + (1 - p) * 20 * s2;
    ctx.strokeText(shown, W / 2, y); ctx.fillStyle = "#ffffff"; ctx.fillText(shown, W / 2, y);
    if(n.unit){ font(ctx, 54 * s2, 700); ctx.lineWidth = 7 * s2; const u = n.unit.toLocaleUpperCase("tr"); ctx.strokeText(u, W / 2, y + 70 * s2); ctx.fillStyle = P.red; ctx.fillText(u, W / 2, y + 70 * s2); }
    ctx.restore();
  };
  const drawHook = t => {
    if(!hook || t > 2.8) return; const a = easeOut(clamp(t / .45)) * easeOut(clamp((2.8 - t) / .4)), s2 = Math.min(W, H) / 1080;
    const words2 = hook.split(/\s+/), lines = []; let cur = "";
    font(ctx, 92 * s2, 800); for(const w of words2){ const tr = cur ? cur + " " + w : w; if(ctx.measureText(tr).width > W * .82 && cur){ lines.push(cur); cur = w; } else cur = tr; } if(cur) lines.push(cur);
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    const nl = Math.min(3, lines.length), hy = face ? faceAvoid(H * .3, nl * 100 * s2 + 30 * s2, H, STYLE.face || face) - (nl - 1) * 50 * s2 : H * (faceSafe ? .5 : .22);
    lines.slice(0, 3).forEach((ln, i) => { const p = easeOut(clamp((t - i * .12) / .5)), yy = hy + i * 100 * s2 + (1 - p) * 18 * s2;
      ctx.globalAlpha = a * p; font(ctx, 92 * s2, 800); ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 9 * s2; ctx.strokeText(ln, W / 2, yy);
      ctx.fillStyle = i === lines.length - 1 && lines.length > 1 ? P.red : "#ffffff"; ctx.fillText(ln, W / 2, yy); });
    ctx.restore();
  };
  const GF = wish.grade || "";   // istenirse renk ayari (istenmezse renge dokunulmaz)
  const drawVid = (src, t) => drawVid0(src, t, GF);
  // Kamera + gecisler: video once vb'ye (kamera ile), sonra gecisle ana kareye
  const vb = new OffscreenCanvas(W, H), vbc = vb.getContext("2d"), holdC = new OffscreenCanvas(W, H), holdX = holdC.getContext("2d");
  let tmp = null; const anchor = face ? {x: face.cx, y: face.cy} : {x: .5, y: .4};
  const drawVid0 = (src, t, gf) => {
    const tr = E.trans.find(x => x.tip !== "cut" && t >= x.t && t < x.t + x.d);
    if(tr && !tr.h){ holdX.drawImage(vb, 0, 0); tr.h = true; }   // kesmeden onceki son kare (A)
    const cam = camAt(t, E, zoomAt(t)); drawCam(vbc, src, W, H, cam, anchor, gf || "");
    if(face){ const z = Math.max(1, cam.z), sc = (v, a) => a + (v - a) * z;   // yakinlasinca yuz buyur: yazilar yeni kutuya gore kacar
      STYLE.face = {...face, y0: clamp(sc(face.y0, anchor.y)), y1: clamp(sc(face.y1, anchor.y)), x0: clamp(sc(face.x0, anchor.x)), x1: clamp(sc(face.x1, anchor.x))}; }
    if(tr){ if(tr.tip === "glitch" && !tmp) tmp = [new OffscreenCanvas(W, H), new OffscreenCanvas(W, H)]; drawTransition(ctx, tr, (t - tr.t) / tr.d, holdC, vb, W, H, tmp, i); }
    else ctx.drawImage(vb, 0, 0);
  };
  let i = 0, t0 = performance.now();
  const fmt = brand ? "info" : (look && look.fmt) || "info", S = Math.min(W, H) / 1080;
  const half = fmt === "bolunmus" ? new OffscreenCanvas(W, Math.round(H / 2)) : null;
  const crop = (src, dx, dy, dw, dh) => { const a = dw / dh, sw = Math.min(W, H * a), sh = sw / a; if(wish.grade) ctx.filter = wish.grade; ctx.drawImage(src, (W - sw) / 2, (H - sh) / 2, sw, sh, dx, dy, dw, dh); ctx.filter = "none"; };
  // kinetik: vurgulanan (yoksa uzun) kelimeler ekranin ortasinda dev tipografi olarak gelir
  const bigWords = fmt === "kinetik" ? words.map((w, k) => ({...w, k})).filter((w, k) => emph.has(k) || (w.w.length >= 7 && k % 4 === 0)).filter((w, k, a) => !k || w.s - a[k - 1].s > 1.6) : [];
  for await (const wc of sink.canvasesAtTimestamps(times())){
    const t = i / FPS;
    if(fmt !== "info"){
      const src = wc ? wc.canvas : null;
      if(fmt === "cerceve"){
        ctx.fillStyle = P.navy; ctx.fillRect(0, 0, W, H);
        const m = W * .06, fy = H * .17, fh = H * .5; if(src) crop(src, m, fy, W - 2 * m, fh);
        ctx.fillStyle = P.red; ctx.fillRect(m, fy + fh, (W - 2 * m) * clamp(t / 1.2), 8 * S);
        const sc0 = scenes.find(x => t >= x.start && t < x.end) || scenes[0];
        if(sc0){ const tt = String(sc0.title1 || "") + (sc0.title2 ? " " + sc0.title2 : ""); ctx.fillStyle = "#fff"; const fs = fitText(ctx, tt, W - 2 * m, 64 * S, 900); ctx.textBaseline = "alphabetic"; ctx.fillText(tt, m, fy - 30 * S);
          ctx.fillStyle = P.red; font(ctx, 24 * S, 800); spaced(ctx, String(sc0.eyebrow || "").toLocaleUpperCase("tr"), m, fy - 34 * S - fs * 1.1, 4 * S); }
      } else if(fmt === "bolunmus"){
        const sc = scenes.find(x => t >= x.start && t < x.end);
        if(src){ if(sc) crop(src, 0, 0, W, H / 2); else ctx.drawImage(src, 0, 0, W, H); }
        if(sc){
          // sahneyi tam boyutta ciz, icerik bolgesini (y .12H-.70H) alt yariya orantili sigdir: kartlar okunur boyutta kalir
          drawScene(sctx, W, H, {...sc, ov: false}, t - sc.start, P);
          const k = easeOut(clamp((t - sc.start) / .7)), sy = H * .12, sh = H * .58, dh = H / 2, dw = W * dh / sh, dx = (W - dw) / 2;
          ctx.save(); ctx.globalAlpha = k * easeOut(clamp((sc.end - t) / .5)); ctx.fillStyle = P.bg1; ctx.fillRect(0, H / 2, W, H / 2);
          ctx.drawImage(scv, 0, sy, W, sh, dx, H / 2 + (1 - k) * 30 * S, dw, dh); ctx.restore();
          ctx.fillStyle = P.red; ctx.fillRect(0, H / 2 - 3 * S, W * k, 6 * S);
          ctx.save(); ctx.translate(0, -H * .27); drawCaption(ctx, W, H, t, groups, emph, P, false); ctx.restore();   // altyazi ust yarida
        } else drawCaption(ctx, W, H, t, groups, emph, P, false);
      } else if(src) drawVid(src, t);
      if(fmt === "kinetik"){
        const b = bigWords.find(x => t >= x.s - .05 && t < x.s + 1.1);
        if(b){ const k = easeOut(clamp((t - b.s + .05) / .45)), o = easeOut(clamp((b.s + 1.1 - t) / .35)), txt = b.w.replace(/[.,!?;:…]+$/, "").toLocaleUpperCase("tr");
          const fs = fitText(ctx, txt, W * .84, 170 * S, 900), y = face ? faceAvoid(H * .42, fs * 1.3, H, STYLE.face || face) : H * .42;
          ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = P.red; ctx.fillRect(0, y - fs * .62, W * k, fs * 1.24);
          ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = o * k; ctx.fillText(txt, W / 2 + (1 - k) * -30 * S, y); ctx.restore(); }
      }
      if(fmt !== "bolunmus") drawCaption(ctx, W, H, t, groups, emph, P, false);
      drawLowerThird(ctx, W, H, t, plan.isim, P); drawHook(t); drawNum(t, false);
      await vsrc.add(t, 1 / FPS);
      if(++i % 15 === 0){ const fps = i / ((performance.now() - t0) / 1000); onStep("Video işleniyor… %" + Math.round(i / n * 100) + " · " + fps.toFixed(0) + " kare/sn"); }
      continue;
    }
    const sc = scenes.find(x => t >= x.start && t < x.end);
    const fadeOut = sc ? easeOut(clamp((sc.end - t) / .5)) : 0;
    if(!sc || sc.ov || fadeOut < 1){ if(wc) drawVid(wc.canvas, t); else { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); } }
    if(sc){ drawScene(sctx, W, H, sc, t - sc.start, P); ctx.save(); ctx.globalAlpha = sc.ov ? fadeOut * easeOut(clamp((t - sc.start) / .6)) : fadeOut; ctx.drawImage(scv, 0, 0); ctx.restore(); }
    drawCaption(ctx, W, H, t, groups, emph, P, !!sc && fadeOut > .5);
    drawLowerThird(ctx, W, H, t, plan.isim, P); drawHook(t); drawNum(t, !!sc);
    await vsrc.add(t, 1 / FPS);
    if(++i % 15 === 0){ const fps = i / ((performance.now() - t0) / 1000); onStep("Video işleniyor… %" + Math.round(i / n * 100) + " · " + fps.toFixed(0) + " kare/sn (donanım hızlandırmalı)"); }
  }
  vsrc.close(); STYLE = {};
  if(abuf && asrc){ onStep("Ses ekleniyor…"); await asrc.add(abuf); asrc.close(); }
  else if(at && asrc){
    onStep("Ses ekleniyor…");
    const ps = new MB.EncodedPacketSink(at); const cfg = await at.getDecoderConfig(); let first = true;
    for await (const pk of ps.packets()){ await asrc.add(pk, first ? {decoderConfig: cfg} : undefined); first = false; }
    asrc.close();
  }
  await output.finalize();
  return new Uint8Array(output.target.buffer);
}

// Test/onizleme: Glow Up altyazisini tek karede ciz
export async function previewCaption(canvas, words, t, brand){
  STYLE = {glow: true, font: brand.font, italic: !!brand.italic, nobox: !!brand.nobox}; await loadFonts(); await loadBrandFont(brand.font, brand.italic);
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#777"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCaption(ctx, canvas.width, canvas.height, t, captionGroups(words), new Set([1]), brandPalette(brand), false); STYLE = {};
}
// Test: bir gorunumle sahne (seffaf/tam) + altyazi tek karede
export async function previewLook(canvas, sc, t, look, words, wt){
  STYLE = {font: look.font, bg: look.bg, wipe: look.wipe, cap: look.cap, noback: true}; await loadFonts(); await loadBrandFont(look.font);
  const P = lookPalette(look), W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#6b7f8f"); g.addColorStop(1, "#3a3f44"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const off = new OffscreenCanvas(W, H); drawScene(off.getContext("2d"), W, H, sc, t, P); ctx.drawImage(off, 0, 0);
  if(words){ drawCaption(ctx, W, H, wt, captionGroups(words), new Set([1]), P, false); }
  STYLE = {};
}
