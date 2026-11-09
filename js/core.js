'use strict';

// 共用工具、狀態、星空背景、粒子特效與音效

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;
// 版面寬高：用實際版面的大小，不用 innerWidth/innerHeight（iPhone 畫面被放大時，那兩個會變成放大後看得到的那一小塊）
const VW = () => document.documentElement.clientWidth || innerWidth;
const VH = () => document.documentElement.clientHeight || innerHeight;
const CARD_RATIO = 1642 / 958;

function rand() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const thumb = (card) => `cards/thumb/${card.file}.jpg`;
const full = (card) => `cards/${card.file}.jpg`;

const state = {
  spread: 'theme',
  phase: 'idle', // idle | shuffling | picking | reading
  deck: [], // 洗好的牌：{ card, reversed }
  picks: [], // { card, reversed, el, slot }
  revealed: 0,
  els: [],
  layout: [],
  fanN: 0,
  dealing: false,
  topic: 'general',
  readingId: null,
  readingTime: 0,
  screen: 'home',
  sceneKey: 'daily',
  muted: false,
};

/* ================= 牌背 ================= */
document.documentElement.style.setProperty('--back', 'url("cards/back.jpg")');

/* ================= 發光貼圖（給兩張 canvas 共用） ================= */
function makeSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.15, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}
const SPRITES = {
  star: makeSprite('rgba(255,244,220,.8)'),
  gold: makeSprite('rgba(255,205,110,.8)'),
  rose: makeSprite('rgba(255,160,200,.7)'),
  cyan: makeSprite('rgba(150,230,255,.7)'),
  ember: makeSprite('rgba(255,140,60,.85)'),
};

function fitCanvas(c) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = VW() * dpr;
  c.height = VH() * dpr;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/* ================= 星空 ================= */
const sky = (() => {
  const canvas = $('#sky');
  let ctx, stars = [], meteors = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let nextMeteor = performance.now() + 2500;

  // 星空水族館：由星星連成的海洋生物，每隔一段時間從夜空游過。
  // 座標以身長為單位：游泳的生物頭朝右（x=1）、尾巴在左（x≈0）；y 向下。
  // parts 是要連線的輪廓（kind 決定怎麼動），dots 是身上的星點，eyes 是金色的眼睛。
  const ellipse = (cx, cy, rx, ry, n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  const wag = (amp, speed) => (px, py, kind, t, ph) =>
    [px, py + Math.sin(t * speed + ph - px * 3.2) * amp * (1 - Math.min(Math.max(px, 0), 1)) ** 2];

  const CREATURES = [
    {
      key: 'shark', zh: '鯊鯊座', size: 1, secs: [17, 23], move: 'swim',
      parts: [{ closed: true, pts: [[1, 0.02], [0.82, -0.09], [0.58, -0.12], [0.48, -0.32], [0.4, -0.12], [0.22, -0.08], [0.08, -0.03],
        [-0.08, -0.24], [0, 0], [-0.05, 0.16], [0.08, 0.04], [0.3, 0.1], [0.5, 0.26], [0.58, 0.11], [0.86, 0.08]] },
      { pts: [[0.67, -0.05], [0.65, 0.06]] }, { pts: [[0.63, -0.05], [0.61, 0.06]] }],
      big: [[1, 0.02], [0.48, -0.32], [-0.08, -0.24], [0.5, 0.26]],
      eyes: [[0.8, -0.03]], label: [0.45, 0.42], trail: [0.02, 0],
      deform: wag(0.075, 0.0042),
    },
    {
      key: 'whaleshark', zh: '鯨鯊座', size: 1.35, secs: [26, 32], move: 'swim',
      parts: [{ closed: true, pts: [[1, -0.04], [0.92, -0.11], [0.7, -0.15], [0.5, -0.15], [0.41, -0.3], [0.35, -0.14], [0.2, -0.08],
        [0.16, -0.13], [0.12, -0.06], [-0.06, -0.3], [0.02, -0.01], [-0.02, 0.18], [0.1, 0.05], [0.3, 0.11], [0.52, 0.27],
        [0.62, 0.12], [0.92, 0.09], [1, 0.05]] },
      { pts: [[0.88, -0.08], [0.6, -0.11], [0.3, -0.06]] }, { pts: [[1, 0.01], [0.9, 0.03]] }],
      dots: [[0.84, -0.04], [0.76, -0.08], [0.76, 0.02], [0.67, -0.1], [0.67, -0.01], [0.67, 0.07], [0.58, -0.07], [0.58, 0.03],
        [0.49, -0.09], [0.49, 0.01], [0.49, 0.08], [0.4, -0.06], [0.4, 0.03], [0.31, -0.02], [0.24, 0.02]],
      big: [[1, -0.04], [0.41, -0.3], [-0.06, -0.3], [0.52, 0.27]],
      eyes: [[0.93, -0.01]], label: [0.45, 0.42], trail: [0.02, 0],
      deform: wag(0.05, 0.003),
    },
    {
      key: 'manta', zh: '魔鬼魟座', size: 0.85, secs: [20, 26], move: 'swim',
      parts: [{ closed: true, pts: [[1, -0.08], [0.92, -0.04], [0.74, -0.2], [0.56, -0.52], [0.46, -0.24], [0.37, -0.05], [0.37, 0.05],
        [0.46, 0.24], [0.56, 0.52], [0.74, 0.2], [0.92, 0.04], [1, 0.08], [0.94, 0]] },
      { kind: 'tail', pts: [[0.37, 0], [0.24, 0], [0.1, 0], [-0.05, 0]] }, { pts: [[0.88, 0], [0.5, 0]] }],
      dots: [[0.66, -0.13], [0.66, 0.13]],
      big: [[0.56, -0.52], [0.56, 0.52], [1, -0.08], [1, 0.08]],
      eyes: [[0.9, -0.07], [0.9, 0.07]], label: [0.55, 0.66], trail: [-0.05, 0], trailKind: 'tail',
      deform(px, py, kind, t, ph) {
        if (kind === 'tail') return [px, py + Math.sin(t * 0.004 - px * 8 + ph) * 0.035 * (0.4 - px)];
        const flap = 0.5 + 0.5 * Math.sin(t * 0.0026 + ph);
        const k = Math.min(Math.abs(py) / 0.5, 1);
        return [px - 0.05 * flap * k, py * (1 - 0.32 * flap * k)];
      },
    },
    {
      key: 'turtle', zh: '海龜座', size: 0.75, secs: [24, 30], move: 'swim',
      parts: [{ closed: true, pts: ellipse(0.5, 0, 0.28, 0.2, 12) },
        { closed: true, pts: [[0.38, 0], [0.45, -0.09], [0.58, -0.09], [0.65, 0], [0.58, 0.09], [0.45, 0.09]] },
        { pts: [[0.77, -0.06], [0.9, -0.06], [0.98, 0], [0.9, 0.06], [0.77, 0.06]] },
        { kind: 'front', pts: [[0.66, -0.16], [0.56, -0.47], [0.52, -0.19]] }, { kind: 'front', pts: [[0.66, 0.16], [0.56, 0.47], [0.52, 0.19]] },
        { kind: 'back', pts: [[0.32, -0.14], [0.18, -0.27], [0.26, -0.09]] }, { kind: 'back', pts: [[0.32, 0.14], [0.18, 0.27], [0.26, 0.09]] },
        { pts: [[0.22, 0], [0.1, 0]] }],
      big: [[0.56, -0.47], [0.56, 0.47], [0.98, 0]],
      eyes: [[0.9, -0.035], [0.9, 0.035]], label: [0.5, 0.6], trail: [0.1, 0],
      deform(px, py, kind, t, ph) {
        if (kind !== 'front' && kind !== 'back') return [px, py];
        const k = Math.min(Math.abs(py) / 0.45, 1), stroke = Math.sin(t * 0.0024 + ph + (kind === 'back' ? 1.8 : 0));
        return [px + (kind === 'front' ? 0.09 : 0.05) * stroke * k, py * (1 - 0.12 * Math.abs(stroke) * k)];
      },
    },
    {
      key: 'jelly', zh: '水母座', size: 0.7, secs: [22, 28], move: 'rise',
      // 傘：從左緣經過頂端到右緣的半橢圓，再沿著波浪狀的傘緣回到左邊
      parts: [{ closed: true, pts: [...Array.from({ length: 9 }, (_, i) => {
        const ang = Math.PI + (i * Math.PI) / 8;
        return [+(0.5 + 0.22 * Math.cos(ang)).toFixed(3), +(-0.05 + 0.3 * Math.sin(ang)).toFixed(3)];
      }), [0.67, -0.02], [0.61, -0.05], [0.56, -0.02], [0.5, -0.05], [0.44, -0.02], [0.39, -0.05], [0.33, -0.02]] },
      ...[0.36, 0.45, 0.55, 0.64].map((x, i) => ({ kind: 'tentacle', pts: [0, 1, 2, 3, 4].map((j) => [x + (i - 1.5) * 0.02 * j, -0.02 + j * 0.12]) }))],
      big: [[0.5, -0.35]],
      eyes: [], label: [0.5, 0.62], trail: [0.5, 0.45], trailKind: 'tentacle',
      deform(px, py, kind, t, ph) {
        const pulse = Math.sin(t * 0.004 + ph);
        if (kind === 'tentacle') return [px + Math.sin(t * 0.003 + py * 7 + ph + px * 9) * 0.04 * (py + 0.05) * 2, py * (1 + 0.06 * pulse)];
        return [0.5 + (px - 0.5) * (1 + 0.1 * pulse), py * (1 - 0.06 * pulse)];
      },
    },
    {
      key: 'seahorse', zh: '海馬座', size: 0.78, secs: [28, 34], move: 'swim',
      parts: [{ closed: true, pts: [[0.8, -0.39], [0.63, -0.42], [0.53, -0.5], [0.45, -0.42], [0.42, -0.26], [0.37, -0.06], [0.39, 0.12],
        [0.47, 0.27], [0.56, 0.34], [0.61, 0.28], [0.55, 0.22], [0.5, 0.14], [0.55, -0.03], [0.56, -0.2], [0.61, -0.32], [0.8, -0.35]] },
      { kind: 'fin', pts: [[0.39, -0.14], [0.3, -0.09], [0.38, -0.01]] }],
      big: [[0.8, -0.37], [0.53, -0.5], [0.56, 0.34]],
      eyes: [[0.57, -0.4]], label: [0.5, 0.52], trail: [0.56, 0.34],
      deform(px, py, kind, t) { return kind === 'fin' ? [px + Math.sin(t * 0.02) * 0.015, py] : [px, py]; },
    },
  ];

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const swimY = () => VH() * (rand() < 0.5 ? 0.16 + rand() * 0.14 : 0.42 + rand() * 0.16);
  let creature = null, lastKey = null, nextCreature = performance.now() + 3500, lastT = 0;

  function spawnCreature(t, key) {
    const pool = CREATURES.filter((c) => c.key !== lastKey);
    const def = CREATURES.find((c) => c.key === key) || (lastKey ? pool[Math.floor(rand() * pool.length)] : CREATURES[0]);
    lastKey = def.key;
    const len = clamp(Math.min(VW(), VH()) * 0.5, 150, 340) * def.size;
    const dur = (def.secs[0] + rand() * (def.secs[1] - def.secs[0])) * 1000;
    const dir = rand() < 0.5 ? 1 : -1;
    creature = def.move === 'rise'
      ? { def, len, dir, x: VW() * (0.15 + rand() * 0.7), y: VH() + len * 0.6, vx: dir * 0.004, vy: -(VH() + len * 1.3) / dur, ph: rand() * 6, trail: [] }
      : { def, len, dir, x: dir > 0 ? -len * 0.7 : VW() + len * 0.7, y: swimY(), vx: (dir * (VW() + len * 1.4)) / dur, vy: 0, ph: rand() * 6, trail: [] };
    nextCreature = t + 1e12;
  }

  function drawCreature(t, dt) {
    const c = creature, d = c.def;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    const gone = d.move === 'rise' ? c.y < -c.len * 0.7 : (c.dir > 0 ? c.x > VW() + c.len * 0.7 : c.x < -c.len * 0.7);
    if (gone) {
      creature = null;
      nextCreature = t + 18000 + rand() * 17000;
      return;
    }
    const edge = d.move === 'rise' ? Math.min(c.y, VH() - c.y) : Math.min(c.x, VW() - c.x);
    const a = clamp((edge + c.len * 0.3) / (c.len * 0.8), 0, 1) * 0.85;
    const bob = Math.sin(t * (d.key === 'seahorse' ? 0.0016 : 0.0009) + c.ph) * (d.key === 'seahorse' ? 22 : 10);
    const flip = d.move === 'rise' ? 1 : c.dir;
    const pos = (p, kind) => {
      const [px, py] = d.deform(p[0], p[1], kind, t, c.ph);
      return [c.x + flip * (px - 0.5) * c.len - mouse.x * 18, c.y + py * c.len + bob - mouse.y * 18];
    };
    const parts = d.parts.map((part) => ({ ...part, xy: part.pts.map((p) => pos(p, part.kind)) }));

    // 身後留下淡淡的星塵
    if (rand() < 0.45) c.trail.push({ p: pos(d.trail, d.trailKind), life: 1 });
    c.trail = c.trail.filter((s) => (s.life -= 0.012) > 0);
    for (const s of c.trail) {
      ctx.globalAlpha = s.life * a * 0.7;
      ctx.drawImage(SPRITES.star, s.p[0] - 4, s.p[1] - 4, 8, 8);
    }

    // 主體裡一層很淡的光，讓輪廓讀得出形狀
    const body = parts[0].xy;
    const [gx, gy] = pos([0.5, d.move === 'rise' ? -0.18 : 0]);
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, c.len * 0.55);
    glow.addColorStop(0, 'rgba(120, 170, 255, .16)');
    glow.addColorStop(1, 'rgba(120, 170, 255, 0)');
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = glow;
    ctx.beginPath();
    body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(200, 222, 255, .62)';
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const part of parts) {
      part.xy.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (part.closed) ctx.closePath();
    }
    ctx.stroke();

    const isBig = (p) => (d.big || []).some(([bx, by]) => bx === p[0] && by === p[1]);
    let n = 0;
    for (const part of parts) {
      part.xy.forEach(([x, y], i) => {
        const tw = 0.7 + 0.3 * Math.sin(t * 0.003 + n++ * 1.7);
        const size = (isBig(part.pts[i]) ? 20 : part.pts.length > 10 ? 11 : 13) * tw;
        ctx.globalAlpha = a * tw;
        ctx.drawImage(SPRITES.star, x - size / 2, y - size / 2, size, size);
      });
    }
    for (const p of d.dots || []) {
      const [x, y] = pos(p);
      const size = 7 + 2 * Math.sin(t * 0.004 + p[0] * 20);
      ctx.globalAlpha = a * 0.85;
      ctx.drawImage(SPRITES.star, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = a;
    for (const p of d.eyes) { const [x, y] = pos(p); ctx.drawImage(SPRITES.gold, x - 8, y - 8, 16, 16); }

    // 星座名稱
    const [lx, ly] = pos(d.label);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = '#c9d6ff';
    ctx.font = '12px "Noto Serif TC", serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.fillText(d.zh, lx, ly);
    ctx.letterSpacing = '0px';
    ctx.globalCompositeOperation = 'lighter';
  }

  function init() {
    ctx = fitCanvas(canvas);
    const n = Math.round((VW() * VH()) / 2600);
    stars = Array.from({ length: n }, () => {
      const z = rand() ** 2;
      return {
        x: rand() * VW(), y: rand() * VH(), z,
        s: 2 + z * 7 + (rand() < 0.03 ? 10 : 0),
        ph: rand() * Math.PI * 2, sp: 0.4 + rand() * 1.6,
      };
    });
  }
  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / VW() - 0.5;
    mouse.ty = e.clientY / VH() - 0.5;
  });

  function frame(t) {
    const dt = Math.min(t - lastT, 50);
    lastT = t;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    ctx.clearRect(0, 0, VW(), VH());
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const a = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph))) * (0.35 + 0.65 * s.z);
      const x = s.x - mouse.x * 30 * s.z, y = s.y - mouse.y * 30 * s.z;
      ctx.globalAlpha = a;
      ctx.drawImage(SPRITES.star, x - s.s / 2, y - s.s / 2, s.s, s.s);
    }
    if (t > nextMeteor) {
      const ang = (20 + rand() * 25) * DEG;
      meteors.push({ x: rand() * VW() * 0.8 + VW() * 0.2, y: rand() * VH() * 0.4, vx: -Math.cos(ang) * 9, vy: Math.sin(ang) * 9, life: 1 });
      nextMeteor = t + 3500 + rand() * 6000;
    }
    meteors = meteors.filter((m) => m.life > 0);
    for (const m of meteors) {
      m.x += m.vx; m.y += m.vy; m.life -= 0.012;
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
      g.addColorStop(0, `rgba(255,245,220,${m.life})`);
      g.addColorStop(1, 'rgba(255,245,220,0)');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
      ctx.stroke();
      ctx.drawImage(SPRITES.star, m.x - 6, m.y - 6, 12, 12);
    }
    if (!creature && !calm && t > nextCreature) spawnCreature(t);
    if (creature) drawCreature(t, dt);
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  init();
  requestAnimationFrame(frame);
  return { init, spawn: (key) => spawnCreature(performance.now(), key) };
})();

/* ================= 粒子特效 ================= */
const fx = (() => {
  const canvas = $('#fx');
  let ctx = fitCanvas(canvas);
  let parts = [], rings = [];
  const kinds = ['gold', 'gold', 'gold', 'star', 'rose', 'cyan'];

  let circles = [];
  function burst(x, y, n = 70, power = 7, palette = kinds) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, v = power * (0.3 + rand());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.06, drag: 0.95, life: 1, decay: 0.008 + rand() * 0.014, s: 6 + rand() * 16, k: palette[(rand() * palette.length) | 0] });
    }
    rings.push({ x, y, r: 10, life: 1 });
  }
  // 翻牌前在牌底下展開的魔法陣：兩道圓環、刻度與旋轉的光點
  function magic(x, y, r, rgb) {
    circles.push({ x, y, r, rgb, t0: performance.now() });
  }
  function drawCircles(t) {
    circles = circles.filter((c) => t - c.t0 < 1100);
    for (const c of circles) {
      const k = (t - c.t0) / 1100;
      const a = Math.sin(Math.min(k * 1.6, 1) * Math.PI / 2) * (1 - Math.max(0, (k - 0.6) / 0.4));
      const rr = c.r * (0.75 + 0.35 * Math.min(k * 2, 1));
      const spin = k * 2.4;
      ctx.globalAlpha = a;
      ctx.strokeStyle = `rgba(${c.rgb},.85)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x, c.y, rr * 0.82, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 24; i++) {
        const ang = spin + (i / 24) * Math.PI * 2, long = i % 3 === 0;
        ctx.beginPath();
        ctx.moveTo(c.x + Math.cos(ang) * rr * 0.84, c.y + Math.sin(ang) * rr * 0.84);
        ctx.lineTo(c.x + Math.cos(ang) * rr * (long ? 0.97 : 0.92), c.y + Math.sin(ang) * rr * (long ? 0.97 : 0.92));
        ctx.stroke();
      }
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const ang = -spin * 0.7 + (i / 6) * Math.PI * 2 * 2;
        const px = c.x + Math.cos(ang) * rr * 0.8, py = c.y + Math.sin(ang) * rr * 0.8;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.globalAlpha = a * 0.5;
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const ang = -spin * 1.5 + (i / 6) * Math.PI * 2, s = 14;
        ctx.globalAlpha = a;
        ctx.drawImage(SPRITES.gold, c.x + Math.cos(ang) * rr - s / 2, c.y + Math.sin(ang) * rr - s / 2, s, s);
      }
    }
  }
  function sparkle(x, y, n = 2) {
    for (let i = 0; i < n; i++) {
      parts.push({ x: x + (rand() - 0.5) * 14, y: y + (rand() - 0.5) * 14, vx: (rand() - 0.5) * 0.8, vy: (rand() - 0.5) * 0.8, g: 0.02, drag: 0.97, life: 1, decay: 0.02 + rand() * 0.02, s: 5 + rand() * 10, k: rand() < 0.7 ? 'gold' : 'star' });
    }
  }
  function mote(x, y) {
    parts.push({ x, y, vx: (rand() - 0.5) * 0.3, vy: -0.3 - rand() * 0.6, g: 0, drag: 1, life: 1, decay: 0.004 + rand() * 0.004, s: 4 + rand() * 8, k: 'gold' });
  }

  let dirty = true;
  function frame() {
    const busy = parts.length || rings.length || circles.length || state.phase === 'shuffling';
    if (!busy && !dirty) { requestAnimationFrame(frame); return; }
    dirty = !!busy;
    ctx.clearRect(0, 0, VW(), VH());
    ctx.globalCompositeOperation = 'lighter';
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, p.life);
      const s = p.s * (0.5 + p.life * 0.5);
      ctx.drawImage(SPRITES[p.k], p.x - s / 2, p.y - s / 2, s, s);
    }
    rings = rings.filter((r) => r.life > 0);
    for (const r of rings) {
      r.r += 5 * r.life + 1; r.life -= 0.025;
      ctx.globalAlpha = r.life * 0.8;
      ctx.strokeStyle = '#f3d68a';
      ctx.lineWidth = 2 * r.life;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawCircles(performance.now());
    ctx.globalAlpha = 1;
    if (state.phase === 'shuffling' && rand() < 0.2) {
      const s = stackPos(0);
      mote(s.x + (rand() - 0.5) * s.w * 1.6, s.y + s.h * 0.4 * rand());
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { burst, sparkle, magic, resize: () => (ctx = fitCanvas(canvas)) };
})();

/* ================= 音效（WebAudio 合成） ================= */
const sound = (() => {
  let ac;
  const ensure = () => {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760];
  function tone(f, when, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(ac.destination);
    o.start(when);
    o.stop(when + dur + 0.05);
  }
  function noise(dur, f0, f1, vol) {
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf;
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, ac.currentTime);
    bp.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur);
    g.gain.value = vol;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start();
  }
  return {
    unlock: ensure,
    chime(i) {
      if (state.muted) return;
      ensure();
      const t = ac.currentTime, base = i % 6;
      [0, 2, 4].forEach((step, k) => tone(NOTES[base + step], t + k * 0.07, 1.6, 0.06));
      tone(NOTES[base] * 2, t + 0.2, 2.2, 0.025);
    },
    riffle() { if (!state.muted) { ensure(); noise(0.35, 3000, 1200, 0.25); } },
    // 轉動牌環或輪盤時，每經過一張牌就輕輕「喀」一聲（太密時跳過）
    tick() {
      if (state.muted || !ac) return;
      const now = ac.currentTime;
      if (now - (this.lastTick || 0) < 0.045) return;
      this.lastTick = now;
      const len = Math.floor(ac.sampleRate * 0.03), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
      const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf;
      bp.type = 'bandpass'; bp.frequency.value = 2400 + Math.random() * 600; bp.Q.value = 2.5;
      g.gain.value = 0.22;
      src.connect(bp).connect(g).connect(ac.destination);
      src.start(now);
    },
    // 翻牌前的蓄力：往上滑的泛音
    charge() {
      if (state.muted) return;
      ensure();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(330, t);
      o.frequency.exponentialRampToValueAtTime(990, t + 0.5);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.65);
    },
    whoosh() { if (!state.muted) { ensure(); noise(0.6, 400, 2400, 0.18); } },
  };
})();
