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
const BGS = ["gradient", "solid", "grid", "editorial"], WIPES = ["diag", "bars", "iris", "slide", "none"], CAPS = ["pop", "glide", "twolayer", "karaoke", "left"];
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
  const cap = CAPS.includes(ai.altyazi) ? ai.altyazi : has(/karaoke/) ? "karaoke" : has(/kelime kelime|yumuşak|soft|zarif/) ? "glide" : has(/sola|sol hizalı/) ? "left" : has(/iki katman|büyük altyazı|vurgulu/) ? "twolayer" : has(/zıpla|pop/) ? "pop" : pick(CAPS, prev.cap);
  const font = FONTS.includes(ai.font) ? ai.font : has(/dar|condensed/) ? "Barlow Condensed" : has(/modern|teknoloji/) ? "Space Grotesk" : pick(FONTS, prev.font);
  return {fmt, pal: palKey, font, bg: pick(BGS, prev.bg), wipe: pick(WIPES, prev.wipe), cap, full: /arka ?plansız|şeffaf|seffaf|kesme|kesmesin/i.test(prefer) ? "none" : /tam ekran/i.test(prefer) ? "all" : ""};
}
export function lookPalette(l){ const c = PAL[l.pal] || PAL.lacivert; return {bg1: "#f5f5f3", bg2: "#e8e8e4", navy: c.navy, red: c.red, gray: "#5f6368", line: "#d0d0cc", card: "#ffffff"}; }
export function brandPalette(b){ return {bg1: "#f6f6f4", bg2: "#ecebe7", navy: b.c1, red: b.c2, gray: "#5f6368", line: "#d4d4d0", card: "#ffffff"}; }

// ---------- yardimcilar ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeBack = t => { if(STYLE.glow || STYLE.noback) return easeOut(t); t = clamp(t); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const prog = (t, start, dur) => clamp((t - start) / dur);
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
function drawScene(ctx, W, H, sc, t, P){
  const dark = sc.type === "alinti";
  STYLE.ov = !!sc.ov;
  if(sc.ov){ ctx.clearRect(0, 0, W, H); const fn = SCENES[sc.type] || SCENES.kartlar; try{ fn(ctx, layout(W, H), t, P, sc, W, H); }catch(e){} STYLE.ov = false; return; }
  background(ctx, W, H, t, P, dark);
  const fn = SCENES[sc.type] || SCENES.kartlar;
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
  // Video surekli kesilmesin: tam ekran yalniz ilk sahne ve alinti; digerleri seffaf (videonun ustunde).
  const full = brand ? null : (look && look.full);
  scenes.forEach((sc, i) => { sc.ov = full === "all" ? false : full === "none" ? sc.type !== "alinti" : sc.type !== "alinti"; });
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
function captionGroups(words){
  const groups = []; let cur = [];
  words.forEach((w, i) => { cur.push({...w, i}); const nx = words[i + 1]; if(cur.length >= 3 || /[.,!?;:…]$/.test(w.w) || !nx || nx.s - w.e > .3){ groups.push(cur); cur = []; } });
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
  const out = clamp((g.en - t) / .12);
  ctx.save(); ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.lineJoin = "round";
  for(const p of parts){
    const a = clamp((t - p.w.s + .04) / .12);
    if(a > 0){
      const dy = (1 - easeOut(a)) * 14 * s, em = emph.has(p.w.i) && !STYLE.nobox; if(em) x += pad;
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
  if(STYLE.cap === "karaoke" || STYLE.cap === "twolayer" || STYLE.cap === "left"){
    if(onScene) return;
    const g = groups.find(x => t >= x.st && t < x.en); if(!g) return;
    const s = Math.min(W, H) / 1080, vert = W < H, out = clamp((g.en - t) / .12), a0 = clamp((t - g.st) / .12) * out;
    const cur = [...g.words].reverse().find(w => t >= w.s - .03) || g.words[0];
    ctx.save(); ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    if(STYLE.cap === "twolayer"){
      const yb = vert ? H * .70 : H * .82;
      font(ctx, 34 * s, 600); ctx.textAlign = "center"; ctx.globalAlpha = a0 * .9; ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 5 * s;
      const line = g.words.map(w => w.w).join(" "); ctx.strokeText(line, W / 2, yb - 70 * s, W * .84); ctx.fillText(line, W / 2, yb - 70 * s, W * .84);
      const k = clamp((t - cur.s) / .15), big = cur.w.replace(/[.,!?;:…]+$/, "").toLocaleUpperCase("tr");
      const fs = fitText(ctx, big, W * .8, 110 * s, 900); ctx.globalAlpha = out * k;
      if(emph.has(cur.i)){ const wd = ctx.measureText(big).width; ctx.fillStyle = P.red; ctx.fillRect(W / 2 - wd / 2 - 18 * s, yb - fs * .6 + (1 - k) * 18 * s, wd + 36 * s, fs * 1.2); }
      else { ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = fs * .08; ctx.strokeText(big, W / 2, yb + (1 - k) * 18 * s); }
      ctx.fillStyle = "#ffffff"; ctx.fillText(big, W / 2, yb + (1 - k) * 18 * s);
    } else {
      const fs = 58 * s, left = STYLE.cap === "left", y = vert ? H * .72 : H * .85;
      font(ctx, fs, 800); const sp = ctx.measureText(" ").width;
      const parts = g.words.map(w => ({w, t: w.w, wd: ctx.measureText(w.w).width}));
      const total = parts.reduce((a, p) => a + p.wd, 0) + sp * (parts.length - 1), k = Math.min(1, W * .82 / total);
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
  const s = Math.min(W, H) / 1080, fs = 62 * s, y = H * (W < H ? .73 : .86);
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
  const s = Math.min(W, H) / 1080, bx = W * .06, by = H * (W < H ? .6 : .72), bw = Math.min(W * .62, 560 * s), bh = 96 * s;
  const pin = easeOut(clamp((t - a) / .35)), pout = clamp((b - t) / .25), x = bx - (1 - pin) * (bw + bx);
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
    capColor: ck ? colors[ck] : "", upper: /büyük harf/.test(q), noCaps: /alt ?yazı (olmasın|yok|istemiyorum|ekleme)|altyazısız/.test(q),
  };
}
export async function renderFast({file, W, H, words, plan, palette = "kurumsal", brand = null, look = null, cut = false, wish = {}, onStep = () => {}}){
  if(typeof VideoEncoder === "undefined") throw new Error("NO_WEBCODECS");
  const MB = await import("/vendor/mediabunny/mediabunny.min.mjs");
  STYLE = brand ? {glow: true, font: brand.font, italic: !!brand.italic, nobox: !!brand.nobox, lower: !!brand.lower} : {};
  if(!brand && look) STYLE = {font: look.font, bg: look.bg, wipe: look.wipe, cap: look.cap, noback: look.cap !== "pop"};
  const P = brand ? brandPalette(brand) : look ? lookPalette(look) : (PALETTES[palette] || PALETTES.kurumsal);
  await loadFonts();
  if(!brand && look && look.font !== "Montserrat"){ onStep("Font yükleniyor (" + look.font + ")…"); await loadBrandFont(look.font); }
  if(brand){ onStep("Marka fontu yükleniyor (" + brand.font + ")…"); await loadBrandFont(brand.font, brand.italic); }
  const scenes = (plan.sahneler || []).filter(sc => SCENES[sc.type] && +sc.end > +sc.start).map(sc => ({...sc, start: +sc.start, end: +sc.end})).sort((a, b) => a.start - b.start).slice(0, 14);
  plan.sahneler = scenes;
  let groups = captionGroups(words); const emph = new Set(plan.vurgu || []);
  const input = new MB.Input({source: new MB.BlobSource(file), formats: MB.ALL_FORMATS});
  const vt = await input.getPrimaryVideoTrack(); const at = await input.getPrimaryAudioTrack();
  if(!vt) throw new Error("Videoda görüntü bulunamadı.");
  const dur = await input.computeDuration();
  const out = new OffscreenCanvas(W, H); const ctx = out.getContext("2d");
  const scv = new OffscreenCanvas(W, H); const sctx = scv.getContext("2d");
  const output = new MB.Output({format: new MB.Mp4OutputFormat({fastStart: "in-memory"}), target: new MB.BufferTarget()});
  const vsrc = new MB.CanvasSource(out, {codec: "avc", bitrate: MB.QUALITY_HIGH, latencyMode: "quality", hardwareAcceleration: "prefer-hardware", keyFrameInterval: 2});
  // Akıcı hareket: kaynak 50+ fps ise 60 fps işle
  FPS = 60;  // grafikler her zaman 60 fps (kaynak 30 fps olsa da animasyonlar akıcı)
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
  let asrc = null, abuf = null;
  if(at && saved > .3){
    try{
      const codec = await MB.getFirstEncodableAudioCodec(["aac", "opus"]);
      const ac = new OfflineAudioContext(1, 1, 48000); const src = await ac.decodeAudioData(await file.arrayBuffer());
      const sr = src.sampleRate, ch = src.numberOfChannels, len = segs.reduce((a, [x, y]) => a + Math.round((y - x) * sr), 0);
      abuf = new AudioBuffer({length: Math.max(1, len), numberOfChannels: ch, sampleRate: sr});
      const fade = Math.round(sr * .012);
      for(let c = 0; c < ch; c++){ const inp = src.getChannelData(c), outp = abuf.getChannelData(c); let o = 0;
        for(const [x, y] of segs){ const i0 = Math.round(x * sr), i1 = Math.min(inp.length, Math.round(y * sr));
          for(let k = i0; k < i1; k++){ const d = Math.min(k - i0, i1 - 1 - k); outp[o++] = inp[k] * (d < fade ? d / fade : 1); } } }
      if(codec){ asrc = new MB.AudioBufferSource({codec, bitrate: 160e3}); output.addAudioTrack(asrc); } else abuf = null;
    }catch(e){ console.warn("Ses kesilemedi, kesme kapatıldı:", e); abuf = null; asrc = null; }
    if(!abuf) return renderFast({file, W, H, words: words.map(w => ({...w, s: toSrc(w.s), e: toSrc(w.e)})), plan, palette, brand, look, cut: false, wish: {...wish, trimStart: 0, trimEnd: 0}, onStep});
  } else if(at){ asrc = new MB.EncodedAudioPacketSource(at.codec); output.addAudioTrack(asrc); }
  await output.start();
  const sink = new MB.CanvasSink(vt, {width: W, height: H, fit: "cover", poolSize: 2});
  const n = Math.max(1, Math.floor(outDur * FPS));
  function* times(){ for(let i = 0; i < n; i++) yield toSrc(i / FPS); }
  // Yumuşak yeniden kadraj: her iki altyazı grubunda bir %7 içeri/dışarı, .6 sn yumuşak geçiş (pop zoom değil)
  const zoomAt = t => { let k = 0; for(let g = 0; g < groups.length; g++){ if(groups[g].st <= t) k = g; else break; } const tgt = Math.floor(k / 2) % 2 ? 1.07 : 1, from = Math.floor(Math.max(0, k - 1) / 2) % 2 ? 1.07 : 1, p = easeOut(clamp((t - (groups[k] ? groups[k].st : 0)) / .6)); return from + (tgt - from) * p; };
  const drawVid = (src, t) => { const z = zoomAt(t); if(z === 1) return ctx.drawImage(src, 0, 0, W, H); const sw = W / z, sh = H / z; ctx.drawImage(src, (W - sw) / 2, (H - sh) * .4, sw, sh, 0, 0, W, H); };
  let i = 0, t0 = performance.now();
  const fmt = brand ? "info" : (look && look.fmt) || "info", S = Math.min(W, H) / 1080;
  const half = fmt === "bolunmus" ? new OffscreenCanvas(W, Math.round(H / 2)) : null;
  const crop = (src, dx, dy, dw, dh) => { const a = dw / dh, sw = Math.min(W, H * a), sh = sw / a; ctx.drawImage(src, (W - sw) / 2, (H - sh) / 2, sw, sh, dx, dy, dw, dh); };
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
        if(sc){ const hc = half.getContext("2d"); drawScene(hc, W, H / 2, {...sc, ov: false}, t - sc.start, P); const k = easeOut(clamp((t - sc.start) / .35)); ctx.drawImage(half, 0, H / 2 + (1 - k) * H / 2); ctx.fillStyle = P.red; ctx.fillRect(0, H / 2 - 4 * S, W * k, 8 * S); }
        drawCaption(ctx, W, H, t, groups, emph, P, !!sc);
      } else if(src) drawVid(src, t);
      if(fmt === "kinetik"){
        const b = bigWords.find(x => t >= x.s - .05 && t < x.s + .9);
        if(b){ const k = easeOut(clamp((t - b.s + .05) / .14)), o = clamp((b.s + .9 - t) / .15), txt = b.w.replace(/[.,!?;:…]+$/, "").toLocaleUpperCase("tr");
          const fs = fitText(ctx, txt, W * .9, 230 * S, 900), y = H * .42;
          ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = P.red; ctx.fillRect(0, y - fs * .62, W * k, fs * 1.24);
          ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, W / 2 + (1 - k) * -80 * S, y); ctx.restore(); }
      }
      if(fmt !== "bolunmus") drawCaption(ctx, W, H, t, groups, emph, P, false);
      drawLowerThird(ctx, W, H, t, plan.isim, P);
      await vsrc.add(t, 1 / FPS);
      if(++i % 15 === 0){ const fps = i / ((performance.now() - t0) / 1000); onStep("Video işleniyor… %" + Math.round(i / n * 100) + " · " + fps.toFixed(0) + " kare/sn"); }
      continue;
    }
    const sc = scenes.find(x => t >= x.start && t < x.end);
    const fadeOut = sc ? clamp((sc.end - t) / .25) : 0;
    if(!sc || sc.ov || fadeOut < 1){ if(wc) drawVid(wc.canvas, t); else { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); } }
    if(sc){ drawScene(sctx, W, H, sc, t - sc.start, P); ctx.save(); ctx.globalAlpha = sc.ov ? fadeOut * clamp((t - sc.start) / .25) : fadeOut; ctx.drawImage(scv, 0, 0); ctx.restore(); }
    drawCaption(ctx, W, H, t, groups, emph, P, !!sc && fadeOut > .5);
    drawLowerThird(ctx, W, H, t, plan.isim, P);
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
