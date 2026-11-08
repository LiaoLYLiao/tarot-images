'use strict';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;
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
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
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
  const swimY = () => innerHeight * (rand() < 0.5 ? 0.16 + rand() * 0.14 : 0.42 + rand() * 0.16);
  let creature = null, lastKey = null, nextCreature = performance.now() + 3500, lastT = 0;

  function spawnCreature(t, key) {
    const pool = CREATURES.filter((c) => c.key !== lastKey);
    const def = CREATURES.find((c) => c.key === key) || (lastKey ? pool[Math.floor(rand() * pool.length)] : CREATURES[0]);
    lastKey = def.key;
    const len = clamp(Math.min(innerWidth, innerHeight) * 0.5, 150, 340) * def.size;
    const dur = (def.secs[0] + rand() * (def.secs[1] - def.secs[0])) * 1000;
    const dir = rand() < 0.5 ? 1 : -1;
    creature = def.move === 'rise'
      ? { def, len, dir, x: innerWidth * (0.15 + rand() * 0.7), y: innerHeight + len * 0.6, vx: dir * 0.004, vy: -(innerHeight + len * 1.3) / dur, ph: rand() * 6, trail: [] }
      : { def, len, dir, x: dir > 0 ? -len * 0.7 : innerWidth + len * 0.7, y: swimY(), vx: (dir * (innerWidth + len * 1.4)) / dur, vy: 0, ph: rand() * 6, trail: [] };
    nextCreature = t + 1e12;
  }

  function drawCreature(t, dt) {
    const c = creature, d = c.def;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    const gone = d.move === 'rise' ? c.y < -c.len * 0.7 : (c.dir > 0 ? c.x > innerWidth + c.len * 0.7 : c.x < -c.len * 0.7);
    if (gone) {
      creature = null;
      nextCreature = t + 18000 + rand() * 17000;
      return;
    }
    const edge = d.move === 'rise' ? Math.min(c.y, innerHeight - c.y) : Math.min(c.x, innerWidth - c.x);
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
    const n = Math.round((innerWidth * innerHeight) / 2600);
    stars = Array.from({ length: n }, () => {
      const z = rand() ** 2;
      return {
        x: rand() * innerWidth, y: rand() * innerHeight, z,
        s: 2 + z * 7 + (rand() < 0.03 ? 10 : 0),
        ph: rand() * Math.PI * 2, sp: 0.4 + rand() * 1.6,
      };
    });
  }
  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / innerWidth - 0.5;
    mouse.ty = e.clientY / innerHeight - 0.5;
  });

  function frame(t) {
    const dt = Math.min(t - lastT, 50);
    lastT = t;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const a = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph))) * (0.35 + 0.65 * s.z);
      const x = s.x - mouse.x * 30 * s.z, y = s.y - mouse.y * 30 * s.z;
      ctx.globalAlpha = a;
      ctx.drawImage(SPRITES.star, x - s.s / 2, y - s.s / 2, s.s, s.s);
    }
    if (t > nextMeteor) {
      const ang = (20 + rand() * 25) * DEG;
      meteors.push({ x: rand() * innerWidth * 0.8 + innerWidth * 0.2, y: rand() * innerHeight * 0.4, vx: -Math.cos(ang) * 9, vy: Math.sin(ang) * 9, life: 1 });
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

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
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

/* ================= 版面計算 ================= */
const headerBottom = () => $('#top').getBoundingClientRect().bottom;

// 洗牌時，牌堆在畫面中央
function stackPos(i) {
  const top = headerBottom() + 16, bottom = innerHeight * 0.86;
  const h = Math.max(120, Math.min((bottom - top) * 0.62, 340, innerWidth * 0.46 * CARD_RATIO));
  return { x: innerWidth / 2, y: (top + bottom) / 2 - i * 0.08, w: h / CARD_RATIO, h, rot: 0 };
}

// 抽牌用的 3D 牌環在畫面下方；cy 是正前方那張牌的中心
function ringGeom() {
  const cw = clamp(innerWidth * 0.16, 62, 104), ch = cw * CARD_RATIO;
  const cy = innerHeight - ch * 0.62 - Math.max(34, innerHeight * 0.05);
  return { cw, ch, cy, top: cy - ch / 2 - 30 };
}

function spreadArea() {
  const top = headerBottom() + 18;
  // 下方要留給：牌環與提示（抽牌）、提示與「全部翻開」（翻牌）、結果按鈕（解讀）
  const multi = SPREADS[state.spread].positions.length > 1;
  const bottom = state.phase === 'reading' ? innerHeight - 78
    : state.phase === 'revealing' ? innerHeight - (multi ? 150 : 104)
    : ringGeom().top - 70;
  const side = innerWidth < 640 ? 8 : 16;
  return { x: side, y: top, w: innerWidth - side * 2, h: Math.max(120, bottom - top) };
}

function fitPositions(pts, area) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    const hx = (p.rot ? CARD_RATIO / 2 : 0.5) * p.s, hy = (p.rot ? 0.5 / CARD_RATIO : 0.5) * p.s;
    minX = Math.min(minX, p.x - hx); maxX = Math.max(maxX, p.x + hx);
    minY = Math.min(minY, p.y - hy); maxY = Math.max(maxY, p.y + hy);
  }
  const pad = 12; // 上方牌位標籤的空間
  const W = Math.min(area.w / (maxX - minX), (area.h - pad) / ((maxY - minY) * CARD_RATIO), 340);
  const H = W * CARD_RATIO;
  const cx = area.x + area.w / 2 - ((minX + maxX) / 2) * W;
  const cy = area.y + pad + (area.h - pad) / 2 - ((minY + maxY) / 2) * H;
  return { W, layout: pts.map((p) => ({ x: cx + p.x * W, y: cy + p.y * H, w: W * p.s, h: H * p.s, rot: p.rot || 0 })) };
}

function computeLayout() {
  const positions = SPREADS[state.spread].positions;
  const area = spreadArea();
  const tall = fitPositions(positions.map((p) => ({ x: p.x, y: p.y, s: p.s || 1, rot: p.rot })), area);
  let best = tall;
  if (positions[0].wx !== undefined) {
    const wide = fitPositions(positions.map((p) => ({ x: p.wx, y: p.wy, s: p.s || 1, rot: p.rot })), area);
    if (wide.W > tall.W) best = wide;
  }
  state.layout = best.layout;
  return state.layout;
}

const cardTransform = (p) => `translate3d(${p.x - p.w / 2}px, ${p.y - p.h / 2}px, 0) rotate(${p.rot}deg)`;
function place(el, p, lift = true) {
  el.style.width = `${p.w}px`;
  el.style.height = `${p.h}px`;
  el.style.transform = cardTransform(p) + (lift ? ' translateY(var(--lift, 0px))' : '');
}

/* ================= 牌位與標籤 ================= */
const TABLE_PHASES = ['dealing', 'picking', 'revealing', 'reading'];
function renderSlots() {
  const slots = $('#slots'), labels = $('#labels');
  const show = TABLE_PHASES.includes(state.phase);
  const positions = SPREADS[state.spread].positions;
  if (slots.children.length !== positions.length || slots.dataset.spread !== state.spread) {
    slots.innerHTML = '';
    labels.querySelectorAll('.slot-label').forEach((l) => l.remove());
    slots.dataset.spread = state.spread;
    positions.forEach((p) => {
      const s = document.createElement('div');
      s.className = 'slot' + (p.rot ? ' cross' : '');
      slots.appendChild(s);
      const l = document.createElement('div');
      l.className = 'slot-label';
      l.textContent = p.name;
      labels.appendChild(l);
    });
  }
  const layout = computeLayout();
  [...slots.children].forEach((s, i) => {
    place(s, layout[i], false);
    s.style.opacity = show ? 1 : 0;
    s.classList.toggle('next', state.phase === 'picking' && i === state.picks.length);
  });
  [...labels.querySelectorAll('.slot-label')].forEach((l, i) => {
    const p = layout[i];
    const lw = l.offsetWidth, lh = l.offsetHeight;
    const x = p.rot ? p.x + p.h * 0.3 : p.x, y = p.rot ? p.y : p.y - p.h / 2;
    l.style.transform = `translate(${x - lw / 2}px, ${y - lh / 2}px)`;
    l.style.opacity = show ? 1 : 0;
  });
}

function updateHint() {
  const hint = $('#hint');
  const positions = SPREADS[state.spread].positions;
  hint.style.opacity = 1;
  if (state.phase === 'picking' && state.picks.length < positions.length && !state.dealing) {
    const p = positions[state.picks.length];
    const from = p.pool === 'major' ? `從 ${state.fanN} 張大阿爾克那中，` : p.pool === 'minor' ? `從 ${state.fanN} 張小阿爾克那中，` : '';
    hint.innerHTML = `${from}選出第 ${state.picks.length + 1} 張牌 · ${p.name}<small>左右滑動牌環，點一張牌抽出</small>`;
    hint.style.top = `${ringGeom().top - 48}px`;
  } else if (state.phase === 'shuffling') {
    hint.textContent = '洗牌中，讓問題在心中沉澱…';
    const s = stackPos(0);
    hint.style.top = `${s.y + s.h / 2 + 24}px`;
  } else if (state.phase === 'revealing' && state.revealed < positions.length) {
    hint.innerHTML = positions.length > 1 ? '牌都到齊了<small>點擊牌，一張一張翻開</small>' : '準備好了嗎？<small>點擊牌翻開今天的指引</small>';
    const a = spreadArea();
    hint.style.top = `${a.y + a.h + 12}px`;
  } else {
    hint.style.opacity = 0;
  }
}

// 標題列中間顯示目前的牌陣與問題類型（只在電腦版）
function updateHeader() {
  const on = TABLE_PHASES.includes(state.phase);
  const topic = TOPICS[state.topic];
  $('#spreadName').textContent = on ? SPREADS[state.spread].name + (topic.field ? ` · ${topic.zh}` : '') : '';
}

/* ================= 牌的建立 ================= */
function makeCard() {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<div class="tilt"><div class="inner">
    <div class="face back"></div>
    <div class="face front"><img alt="" draggable="false"><div class="holo"></div><div class="glare"></div></div>
  </div></div>`;
  return el;
}

// 牌堆一開始藏著，洗牌時才出現
function buildStack() {
  const table = $('#table');
  table.innerHTML = '';
  state.els = CARDS.map((_, i) => {
    const el = makeCard();
    el.classList.add('stack');
    el.style.transitionDuration = '0s';
    el.style.opacity = 0;
    el.style.pointerEvents = 'none';
    place(el, stackPos(i));
    table.appendChild(el);
    el.addEventListener('click', onCardClick);
    return el;
  });
  requestAnimationFrame(() => state.els.forEach((el) => (el.style.transitionDuration = '')));
}

function onCardClick(e) {
  const el = e.currentTarget;
  const p = state.picks.find((q) => q.el === el);
  if (!p) return;
  if (state.phase === 'revealing' && !p.revealed) reveal(p);
  else if (el.classList.contains('flipped')) openModal(p);
}

/* ================= 起始頁：星座軌道選情境 ================= */
const home = $('#home');
const SCENE_KEYS = ['daily', 'love', 'career', 'study', 'self', 'general'];
const SCENES = {
  daily: { name: '每日一牌', en: 'I · The Daily Card', sub: '今天的指引，一天只能抽一張' },
  love: { name: '感情', en: 'II · Love', sub: '靜下心，想著那個人，或那段關係' },
  career: { name: '事業', en: 'III · Career', sub: '想著你在工作上的處境與抉擇' },
  study: { name: '學業', en: 'IV · Study', sub: '想著你的學習目標，或眼前的考試' },
  self: { name: '自我成長', en: 'V · Inner Self', sub: '把注意力，慢慢放回自己身上' },
  general: { name: '綜合', en: 'VI · Any Question', sub: '在心中默念，任何你想問的事' },
};
const AURA = { daily: '232,200,119', general: '120,90,220', love: '255,110,170', career: '240,180,80', study: '80,180,255', self: '160,120,255' };

function setAura(key) {
  const rgb = AURA[key] || AURA.general;
  const aura = $('#aura');
  aura.style.opacity = 0;
  setTimeout(() => { aura.style.setProperty('--aura', rgb); aura.style.opacity = 1; }, 250);
  home.style.setProperty('--accent-rgb', rgb);
  $('#wheel').style.setProperty('--accent-rgb', rgb);
}

function showScreen(name) {
  home.classList.toggle('show', name === 'home');
  state.screen = name;
  if (name === 'home') orbit.start(); else orbit.stop();
}

// 情境排在中央牌卡周圍的橢圓軌道上；轉到正前方（角度 90°）的就是選到的情境。
// 今天已經抽過每日一牌時，每日一牌就從軌道上收起來。
const orbit = (() => {
  const root = $('#orbit'), card = root.querySelector('.orbit-card');
  let orbs = [], keys = [], stepA = 1, base = Math.PI / 2, target = base, drag = null, raf = 0;

  function refresh() {
    const all = [...root.querySelectorAll('.orb')];
    const showDaily = !todayDaily();
    all.forEach((o) => (o.hidden = o.dataset.scene === 'daily' && !showDaily));
    orbs = all.filter((o) => !o.hidden);
    keys = orbs.map((o) => o.dataset.scene);
    stepA = (Math.PI * 2) / orbs.length;
  }

  function frame() {
    base += (target - base) * 0.12;
    const w = root.clientWidth, h = root.clientHeight;
    const cx = w / 2, cy = h / 2, rx = w * 0.42, ry = h * 0.3;
    orbs.forEach((o, i) => {
      const a = base + i * stepA, depth = (Math.sin(a) + 1) / 2;
      o.style.transform = `translate(${cx + Math.cos(a) * rx}px, ${cy + Math.sin(a) * ry}px) translate(-50%, -50%) scale(${(0.66 + depth * 0.44).toFixed(3)})`;
      o.style.opacity = (0.3 + depth * 0.7).toFixed(2);
      o.style.zIndex = depth > 0.55 ? 3 : 1;
    });
    raf = requestAnimationFrame(frame);
  }

  function select(i) {
    const n = orbs.length, sel = ((i % n) + n) % n;
    let t = Math.PI / 2 - sel * stepA; // 走最短的方向轉過去
    while (t - base > Math.PI) t -= Math.PI * 2;
    while (t - base < -Math.PI) t += Math.PI * 2;
    target = t;
    orbs.forEach((o, k) => o.classList.toggle('on', k === sel));
    card.classList.remove('spin');
    void card.offsetWidth;
    card.classList.add('spin');
    selectScene(keys[sel]);
  }

  root.addEventListener('pointerdown', (e) => {
    drag = { last: e.clientX, moved: 0 };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.last;
    drag.last = e.clientX;
    drag.moved += Math.abs(dx);
    base += dx * 0.012;
    target = base;
  });
  root.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.moved < 6) {
      const hit = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList?.contains('orb'));
      if (hit) select(orbs.indexOf(hit));
      return;
    }
    select(Math.round((Math.PI / 2 - base) / stepA)); // 放開時停在最靠近正前方的情境
  });
  // 鍵盤操作（Enter／空白鍵）
  root.addEventListener('click', (e) => {
    const o = e.target.closest('.orb');
    if (o && e.detail === 0) select(orbs.indexOf(o));
  });

  return {
    select(key) { refresh(); select(Math.max(keys.indexOf(key), 0)); },
    start() { if (!raf) raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
})();

// 每個情境目前選的牌陣（預設是最推薦的那個）
const sceneSpread = {};

function selectScene(key) {
  state.sceneKey = key;
  const info = SCENES[key];
  home.querySelector('.scene-en').textContent = info.en;
  home.querySelector('.scene-info h2').textContent = info.name;
  home.querySelector('.scene-sub').textContent = info.sub;
  setAura(key);
  const daily = key === 'daily';
  home.classList.toggle('daily', daily);
  if (!daily) {
    setTopic(key);
    store.set('starTarot.scene', key);
  }
  updateStart();
}

function updateStart() {
  const key = state.sceneKey;
  if (key === 'daily') {
    $('#startBtn .t').textContent = '抽今天的牌';
    $('#startBtn .s').textContent = '每日一牌 · 1 張';
    return;
  }
  const sp = sceneSpread[key] || TOPIC_SPREADS[key][0];
  sceneSpread[key] = sp;
  $('#startBtn .t').textContent = '開始洗牌';
  $('#startBtn .s').textContent = `${SPREADS[sp].name} · ${SPREADS[sp].positions.length} 張`;
  $('#spreadBtn').innerHTML = spreadDiagram(sp);
}

// 回到起始頁；今天還沒抽每日一牌就先停在每日一牌，抽過了就回到上次的情境
function showHome(key) {
  showScreen('home');
  const pick = !todayDaily() && !key ? 'daily' : key && key !== 'daily' ? key : store.get('starTarot.scene', 'general');
  orbit.select(pick);
  wheel.close(true);
}

$('#startBtn').addEventListener('click', () => {
  if (state.phase !== 'idle') return;
  sound.unlock();
  if (state.sceneKey === 'daily') {
    if (todayDaily()) return showHome();
    setTopic('general');
    $('#question').value = '';
    startReading('one');
  } else {
    startReading(sceneSpread[state.sceneKey]);
  }
});

/* ================= 牌陣輪盤 ================= */
// 右側的牌陣按鈕展開成一個可以旋轉的輪盤；轉到正上方的就是選中的牌陣
const wheel = (() => {
  const root = $('#wheel'), dial = root.querySelector('.dial'), hub = root.querySelector('.hub');
  let items = [], keys = [], step = 0, rot = 0, target = 0, drag = null, raf = 0, sel = 0;

  function build() {
    const recs = TOPIC_SPREADS[state.sceneKey];
    keys = [...recs, ...Object.keys(SPREADS).filter((k) => k !== 'one' && !recs.includes(k))];
    step = 360 / keys.length;
    dial.innerHTML = keys.map((k, i) => `<button class="wi ${i === 0 ? 'rec' : ''}" data-i="${i}" style="--a:${i * step}deg">
      ${spreadDiagram(k)}<span>${SPREADS[k].name}</span>${i === 0 ? '<em>推薦</em>' : ''}</button>`).join('');
    items = [...dial.children];
  }

  function frame() {
    rot += (target - rot) * 0.16;
    dial.style.setProperty('--rot', `${rot}deg`);
    raf = Math.abs(target - rot) > 0.05 || drag ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function focus(i, animate = true) {
    const n = keys.length;
    sel = ((i % n) + n) % n;
    let t = -sel * step;
    while (t - rot > 180) t -= 360;
    while (t - rot < -180) t += 360;
    target = t;
    if (!animate) rot = t;
    items.forEach((el, k) => el.classList.toggle('on', k === sel));
    const sp = SPREADS[keys[sel]];
    hub.querySelector('.hd').innerHTML = spreadDiagram(keys[sel]);
    hub.querySelector('.hn').textContent = sp.name;
    hub.querySelector('.hc').textContent = `${sp.positions.length} cards`;
    hub.querySelector('.hb').textContent = sp.blurb;
    kick();
  }

  function open() {
    if (state.sceneKey === 'daily') return;
    build();
    // 從右側按鈕的位置展開
    const b = $('#spreadBtn').getBoundingClientRect();
    root.style.setProperty('--ox', `${b.left + b.width / 2}px`);
    root.style.setProperty('--oy', `${b.top + b.height / 2}px`);
    focus(Math.max(keys.indexOf(sceneSpread[state.sceneKey]), 0), false);
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add('open');
    sound.whoosh();
  }

  function close(instant) {
    if (root.hidden) return;
    root.classList.remove('open');
    if (instant) root.hidden = true;
    else setTimeout(() => { if (!root.classList.contains('open')) root.hidden = true; }, 380);
  }

  function choose() {
    sceneSpread[state.sceneKey] = keys[sel];
    updateStart();
    close();
    const b = $('#spreadBtn');
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }

  const angleAt = (e) => {
    const r = dial.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) / DEG;
  };
  dial.addEventListener('pointerdown', (e) => {
    drag = { a: angleAt(e), moved: 0 };
    dial.setPointerCapture(e.pointerId);
  });
  dial.addEventListener('pointermove', (e) => {
    if (!drag) return;
    let d = angleAt(e) - drag.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    drag.a += d;
    drag.moved += Math.abs(d);
    rot += d;
    target = rot;
    kick();
  });
  dial.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.moved < 4) {
      const hit = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList?.contains('wi'));
      if (hit) { +hit.dataset.i === sel ? choose() : focus(+hit.dataset.i); }
      return;
    }
    focus(Math.round(-rot / step));
  });
  root.addEventListener('click', (e) => {
    if (e.target.closest('.hub-ok')) choose();
    else if (e.target === root || e.target.closest('.wheel-close')) close();
  });
  $('#spreadBtn').addEventListener('click', open);

  return { open, close };
})();

// 牌陣的縮圖：用直式排法畫出每個牌位的小方塊
function spreadDiagram(key) {
  const ps = SPREADS[key].positions;
  const boxes = ps.map((p) => {
    const s = p.s || 1, w = (p.rot ? CARD_RATIO : 1) * s, h = (p.rot ? 1 : CARD_RATIO) * s;
    return { x: p.x - w / 2, y: p.y * CARD_RATIO - h / 2, w, h };
  });
  const minX = Math.min(...boxes.map((b) => b.x)), maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y)), maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const k = 36 / Math.max(maxX - minX, maxY - minY);
  const ox = (44 - (maxX - minX) * k) / 2, oy = (44 - (maxY - minY) * k) / 2;
  return `<svg class="diagram" viewBox="0 0 44 44" aria-hidden="true">${boxes.map((b) =>
    `<rect x="${(ox + (b.x - minX) * k).toFixed(1)}" y="${(oy + (b.y - minY) * k).toFixed(1)}" width="${(b.w * k - 1.2).toFixed(1)}" height="${(b.h * k - 1.2).toFixed(1)}" rx="1"/>`).join('')}</svg>`;
}

function startReading(spreadKey) {
  state.spread = spreadKey;
  $('#question').blur();
  showScreen('table');
  startShuffle();
}

/* ================= 洗牌 ================= */
let motionAsked = false;
async function askMotion() {
  if (motionAsked) return;
  motionAsked = true;
  if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
    try { await DeviceMotionEvent.requestPermission(); } catch { /* 使用者拒絕就算了 */ }
  }
}

async function startShuffle() {
  if (state.phase === 'shuffling') return;
  sound.unlock();
  askMotion();
  state.phase = 'shuffling';
  state.deck = shuffled(CARDS).map((card) => ({ card, reversed: rand() < 0.35 }));
  renderSlots();
  updateHeader();

  const els = state.els;
  els.forEach((el) => { el.classList.add('stack'); el.style.opacity = 1; });
  els.forEach((el, i) => { el.style.transitionDuration = '.5s'; el.style.transitionDelay = `${(els.length - i) * 3}ms`; place(el, stackPos(i)); });
  updateHint();
  await sleep(600);

  const s = stackPos(0);
  for (let round = 0; round < 3; round++) {
    sound.riffle();
    els.forEach((el, i) => {
      const side = rand() < 0.5 ? -1 : 1;
      el.style.transitionDuration = '.28s';
      el.style.transitionDelay = `${i * 2}ms`;
      place(el, { ...stackPos(i), x: s.x + side * Math.min(s.w * (0.55 + rand() * 0.15), innerWidth / 2 - s.w / 2 - 6), y: s.y - i * 0.25 + (rand() - 0.5) * 10, rot: side * (6 + rand() * 6) });
    });
    await sleep(430);
    const table = $('#table');
    shuffled(state.els).forEach((el) => table.appendChild(el));
    state.els = [...table.children];
    state.els.forEach((el, i) => { el.style.transitionDelay = `${i * 2}ms`; place(el, stackPos(i)); });
    await sleep(420);
  }

  state.els.forEach((el, k) => (el.dataset.k = k));
  state.phase = 'dealing';
  renderSlots();
  await dealRing();
  state.phase = 'picking';
  renderSlots();
  updateHint();
}

/* ================= 3D 牌環 ================= */
const ring = (() => {
  const root = $('#pickRing'), spin = root.querySelector('.spin');
  let cards = [], step = 0, R = 0, rot = 0, vel = 0, drag = null, raf = 0, intro = null, frontIdx = -1;

  function layout() {
    const g = ringGeom();
    const n = Math.max(cards.length, 1);
    step = 360 / n;
    R = Math.max((n * g.cw * 0.52) / (2 * Math.PI), g.cw * 2.3);
    root.style.top = `${g.top - 40}px`;
    root.style.perspectiveOrigin = `50% ${g.cy - (g.top - 40)}px`;
    spin.style.top = `${g.cy - (g.top - 40)}px`;
    spin.style.setProperty('--R', `${R}px`);
    cards.forEach((c, i) => {
      Object.assign(c.el.style, { width: `${g.cw}px`, height: `${g.ch}px`, marginLeft: `${-g.cw / 2}px`, marginTop: `${-g.ch / 2}px` });
      c.el.style.setProperty('--a', `${i * step}deg`);
    });
  }

  function frame(t) {
    if (intro) {
      // 發牌時牌環從遠處旋轉進來
      const k = Math.min((t - intro.t0) / 1300, 1), e = 1 - (1 - k) ** 3;
      rot = intro.from * (1 - e);
      root.style.setProperty('--open', e.toFixed(3));
      if (k >= 1) { intro = null; root.classList.add('ready'); }
    } else if (!drag) {
      rot += vel;
      vel *= 0.92;
      if (Math.abs(vel) < 0.04) { const target = Math.round(rot / step) * step; rot += (target - rot) * 0.14; }
    }
    // 先把牌環往後推，再以正前方那張牌為軸稍微俯視，正前方的牌就會固定在 cy
    spin.style.transform = `rotateX(-9deg) translateZ(calc(var(--R) * -1)) rotateY(${rot}deg)`;
    const n = cards.length;
    const idx = n ? (((Math.round(-rot / step) % n) + n) % n) : -1;
    if (idx !== frontIdx) {
      cards[frontIdx]?.el.classList.remove('facing');
      cards[idx]?.el.classList.add('facing');
      frontIdx = idx;
    }
    raf = requestAnimationFrame(frame);
  }

  root.addEventListener('pointerdown', (e) => {
    if (!cards.length || intro) return;
    drag = { x: e.clientX, last: e.clientX, moved: 0 };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.last;
    drag.last = e.clientX;
    drag.moved += Math.abs(dx);
    const k = step / (ringGeom().cw * 0.55);
    rot += dx * k;
    vel = dx * k;
  });
  root.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d || d.moved > 6) return;
    root.releasePointerCapture(e.pointerId);
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((x) => x.classList?.contains('rcard'));
    if (hit) pickFromRing(+hit.dataset.k);
  });
  root.addEventListener('wheel', (e) => {
    if (!cards.length) return;
    e.preventDefault();
    vel += (e.deltaX || e.deltaY) * -0.02;
  }, { passive: false });

  return {
    show(ks) {
      spin.innerHTML = '';
      cards = ks.map((k) => {
        const el = document.createElement('div');
        el.className = 'rcard';
        el.dataset.k = k;
        el.innerHTML = '<div class="face back"></div>';
        spin.appendChild(el);
        return { k, el };
      });
      frontIdx = -1;
      layout();
      root.hidden = false;
      root.classList.remove('out', 'ready');
      intro = { t0: performance.now(), from: 300 };
      root.style.setProperty('--open', 0);
      if (!raf) raf = requestAnimationFrame(frame);
      return 1300;
    },
    remove(k) {
      const i = cards.findIndex((c) => c.k === k);
      if (i < 0) return;
      cards[i].el.remove();
      cards.splice(i, 1);
      frontIdx = -1;
      // 讓剩下的牌補上空位，並保持原本正前方的位置
      const oldStep = step;
      layout();
      rot = (rot / oldStep) * step;
    },
    rectOf(k) { return cards.find((c) => c.k === k)?.el.getBoundingClientRect(); },
    async hide() {
      if (root.hidden) return;
      root.classList.add('out');
      await sleep(450);
      root.hidden = true;
      spin.innerHTML = '';
      cards = [];
      cancelAnimationFrame(raf);
      raf = 0;
    },
    layout,
  };
})();

const poolOf = (slot) => SPREADS[state.spread].positions[slot]?.pool;
const inPool = (card, pool) => !pool || (pool === 'major') === card.major;

// 依下一個牌位需要的牌池（大牌／小牌／全部）組成牌環，牌堆收進牌環裡
async function dealRing() {
  const pool = poolOf(state.picks.length);
  const ks = state.els.filter((el) => !el.classList.contains('flying') && !el.classList.contains('placed'))
    .map((el) => +el.dataset.k).filter((k) => inPool(state.deck[k].card, pool));
  state.fanN = ks.length;
  const g = ringGeom();
  state.els.forEach((el) => {
    if (el.classList.contains('flying') || el.classList.contains('placed')) return;
    el.classList.remove('stack');
    el.style.transitionDuration = '.55s';
    el.style.transitionDelay = '0ms';
    el.style.opacity = 0;
    el.style.pointerEvents = 'none';
    place(el, { x: innerWidth / 2, y: g.cy, w: g.cw, h: g.ch, rot: 0 });
  });
  sound.whoosh();
  await sleep(350);
  const ms = ring.show(ks);
  for (let i = 0; i < 14; i++) setTimeout(() => fx.sparkle(innerWidth * (0.15 + Math.random() * 0.7), g.cy + (Math.random() - 0.5) * g.ch, 2), i * 60);
  await sleep(ms);
}

/* ================= 抽牌 ================= */
function pickFromRing(k) {
  const positions = SPREADS[state.spread].positions;
  if (state.phase !== 'picking' || state.dealing || state.picks.length >= positions.length) return;
  if (!inPool(state.deck[k].card, poolOf(state.picks.length))) return;
  const el = state.els.find((x) => +x.dataset.k === k);
  const r = ring.rectOf(k);
  if (!el || !r) return;
  el.style.transitionDuration = '0s';
  el.style.opacity = 1;
  el.style.pointerEvents = '';
  place(el, { x: r.left + r.width / 2, y: r.top + r.height / 2, w: ringGeom().cw, h: ringGeom().ch, rot: 0 });
  ring.remove(k);
  if (navigator.vibrate) navigator.vibrate(12);
  pick(el);
}

// 牌沿著弧線飛到牌位：先往上揚起、微微傾斜，再落下
async function flyTo(el, to, ms = 950) {
  const from = { x: 0, y: 0, w: parseFloat(el.style.width), h: parseFloat(el.style.height), rot: 0 };
  const r = el.getBoundingClientRect();
  from.x = r.left + r.width / 2;
  from.y = r.top + r.height / 2;
  const mid = {
    x: (from.x + to.x) / 2 + (rand() - 0.5) * 50, y: Math.min(from.y, to.y) - 70 - rand() * 40,
    w: to.w * 1.15, h: to.h * 1.15, rot: (to.x < from.x ? -1 : 1) * (10 + rand() * 8) + (to.rot || 0) / 2,
  };
  const kf = (p) => ({ transform: cardTransform(p), width: `${p.w}px`, height: `${p.h}px` });
  const anim = el.animate([kf(from), { ...kf(mid), offset: 0.45 }, kf(to)], { duration: ms, easing: 'cubic-bezier(.45,.05,.25,1)' });
  place(el, to);
  const t0 = performance.now();
  (function trail() {
    const b = el.getBoundingClientRect();
    fx.sparkle(b.left + b.width / 2, b.top + b.height / 2, 3);
    if (performance.now() - t0 < ms - 80) requestAnimationFrame(trail);
  })();
  await anim.finished.catch(() => {});
}

async function pick(el) {
  const positions = SPREADS[state.spread].positions;
  const slot = state.picks.length;
  const { card, reversed } = state.deck[+el.dataset.k];
  const p = { card, reversed, el, slot };
  state.picks.push(p);
  el.querySelector('img').src = thumb(card);
  el.classList.remove('stack');
  el.classList.add('flying');
  el.classList.toggle('reversed', reversed);
  el.style.setProperty('--lift', '0px');
  sound.whoosh();
  renderSlots();

  const last = state.picks.length === positions.length;
  if (last) {
    $('#hint').style.opacity = 0;
    ring.hide();
  } else if (poolOf(slot + 1) !== poolOf(slot)) {
    // 換牌池：牌環收起來，換另一組牌重新組成牌環
    state.dealing = true;
    updateHint();
    (async () => {
      await ring.hide();
      await dealRing();
      state.dealing = false;
      updateHint();
    })();
  } else {
    updateHint();
  }

  await flyTo(el, state.layout[slot]);
  el.classList.remove('flying');
  el.classList.add('placed', 'facedown');
  const b = el.getBoundingClientRect();
  fx.burst(b.left + b.width / 2, b.top + b.height / 2, 16, 3);
  if (last) {
    await sleep(500);
    startReveal();
  }
}

/* ================= 翻牌 ================= */
const KIND_FX = {
  major: { burst: ['gold', 'star', 'gold', 'rose'], color: '255,226,150' },
  cups: { burst: ['cyan', 'star', 'cyan'], color: '150,220,255' },
  wands: { burst: ['ember', 'gold', 'ember'], color: '255,160,80' },
  swords: { burst: ['star', 'cyan', 'star'], color: '210,230,255' },
  pentacles: { burst: ['gold', 'gold', 'star'], color: '255,214,120' },
};
const kindOf = (card) => (card.major ? 'major' : card.suit.toLowerCase());

function startReveal() {
  state.phase = 'revealing';
  relayoutPlaced();
  for (const p of state.picks) p.el.classList.add('ready');
  $('#revealBar').hidden = SPREADS[state.spread].positions.length < 2;
  updateHint();
  updateHeader();
}

async function reveal(p) {
  if (p.revealing || p.revealed) return;
  p.revealing = true;
  const el = p.el, img = el.querySelector('img');
  const kind = KIND_FX[kindOf(p.card)];
  el.classList.remove('ready');
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

  // 1. 蓄力：牌發光微震，腳下展開魔法陣
  el.classList.add('charging');
  fx.magic(cx, cy, Math.max(r.width, r.height) * 0.62, kind.color);
  sound.charge();
  await Promise.all([Promise.race([img.decode().catch(() => {}), sleep(1500)]), sleep(520)]);

  // 2. 翻牌：牌往你的方向浮起，同時翻面
  el.classList.remove('charging', 'facedown');
  el.classList.add('flipping', 'flipped');
  if (navigator.vibrate) navigator.vibrate([10, 40, 22]);
  await sleep(380);

  // 3. 揭曉：依牌的類型噴出光點，大牌多一道全畫面的光
  fx.burst(cx, cy, p.card.major ? 110 : 70, p.card.major ? 9 : 7, kind.burst);
  if (p.card.major) flash(kind.color);
  sound.chime(p.slot);
  showRevealName(p, r);
  await sleep(520);
  el.classList.remove('flipping');
  el.classList.add('shine');
  bindHolo(el, el);
  live.attach(el.querySelector('.front'), p.card);

  p.revealed = true;
  state.revealed++;
  updateHint();
  const total = SPREADS[state.spread].positions.length;
  if (state.revealed === total) {
    $('#revealBar').hidden = true;
    await sleep(1100);
    enterReading();
  }
}

async function revealAll() {
  $('#revealBar').hidden = true;
  for (const p of [...state.picks].sort((a, b) => a.slot - b.slot)) {
    if (p.revealed || p.revealing) continue;
    reveal(p);
    await sleep(700);
  }
}

function flash(rgb) {
  const f = $('#flash');
  f.style.setProperty('--flash', rgb);
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
}

function showRevealName(p, r) {
  const tag = document.createElement('div');
  tag.className = 'reveal-name' + (p.reversed ? ' rev' : '');
  tag.innerHTML = `${p.card.zh}<small>${p.reversed ? '逆位' : '正位'}</small>`;
  $('#labels').appendChild(tag);
  const w = tag.offsetWidth;
  tag.style.left = `${clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8)}px`;
  tag.style.top = `${Math.min(r.bottom - 10, innerHeight - 60)}px`;
  setTimeout(() => tag.remove(), 2200);
}

function enterReading() {
  state.phase = 'reading';
  state.readingTime = Date.now();
  state.readingId = state.readingTime.toString(36) + Math.floor(rand() * 1e6).toString(36);
  saveHistory(currentReading());
  const leftovers = state.els.filter((el) => !el.classList.contains('placed'));
  setTimeout(() => leftovers.forEach((el) => el.remove()), 600);
  relayoutPlaced();
  $('#actions').hidden = false;
  updateHint();
  setTimeout(() => drawLines(true), 950);
}

function relayoutPlaced() {
  renderSlots();
  for (const p of state.picks) {
    if (p.el.classList.contains('flying')) continue;
    p.el.style.transitionDuration = '.9s';
    p.el.style.transitionDelay = '0ms';
    place(p.el, state.layout[p.slot]);
  }
}

// 回到情境頁（toLanding 時回起始頁）
async function resetReading(toLanding) {
  if (state.phase === 'shuffling' || state.phase === 'dealing') return;
  closeTooltip();
  $('#lines').innerHTML = '';
  $('#actions').hidden = true;
  $('#revealBar').hidden = true;
  ring.hide();
  state.picks.forEach((p) => live.detach(p.el.querySelector('.front')));
  state.els.forEach((el) => {
    el.style.transitionDuration = '.5s';
    el.style.opacity = 0;
    el.style.pointerEvents = 'none';
  });
  state.phase = 'idle';
  state.picks = [];
  state.revealed = 0;
  state.fanN = 0;
  state.dealing = false;
  renderSlots();
  updateHint();
  updateHeader();
  await sleep(450);
  buildStack();
  showHome(toLanding ? null : state.spread === 'one' ? 'daily' : state.topic);
}

/* ================= 全息效果 ================= */
function bindHolo(target, el) {
  target.addEventListener('pointermove', (e) => {
    const r = target.getBoundingClientRect();
    const px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
    el.style.setProperty('--rx', `${(px - 0.5) * 22}deg`);
    el.style.setProperty('--ry', `${(0.5 - py) * 22}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    el.style.setProperty('--hx', `${px * 100}%`);
    el.style.setProperty('--hy', `${py * 100}%`);
    el.classList.add('active');
  });
  target.addEventListener('pointerleave', () => {
    ['--rx', '--ry'].forEach((v) => el.style.setProperty(v, '0deg'));
    el.classList.remove('active');
  });
}

/* ================= 星座連線 ================= */
function drawLines(animate) {
  const svg = $('#lines');
  if (state.phase !== 'reading') { svg.innerHTML = ''; return; }
  const sp = SPREADS[state.spread];
  const rects = state.layout.map((p) => {
    const hw = (p.rot ? p.h : p.w) / 2, hh = (p.rot ? p.w : p.h) / 2;
    return [p.x - hw - 4, p.y - hh - 4, p.x + hw + 4, p.y + hh + 4];
  });
  const covered = (x, y) => rects.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);

  let html = `<defs>
    <filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${innerWidth}" height="${innerHeight}">
      <feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="lineGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${innerWidth}" y2="${innerHeight}">
      <stop offset="0" stop-color="#fbe9b0"/><stop offset=".5" stop-color="#e8c877"/><stop offset="1" stop-color="#c9b8ff"/>
    </linearGradient></defs>`;
  sp.edges.forEach(([a, b], idx) => {
    const A = state.layout[a], B = state.layout[b];
    if (Math.hypot(A.x - B.x, A.y - B.y) < 1) return;
    // 找出兩張牌之間沒被牌蓋住的那一段
    // 如果線會穿過第三張牌（出現不只一段空隙）就不畫
    let best = null, run = null, runs = 0;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200, x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
      if (!covered(x, y)) {
        if (!run) runs++;
        run = run ? [run[0], t] : [t, t];
        if (!best || run[1] - run[0] > best[1] - best[0]) best = run;
      } else run = null;
    }
    if (runs !== 1 || best[1] - best[0] < 0.01) return;
    const P = (t) => [A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t];
    const [x1, y1] = P(best[0]), [x2, y2] = P(best[1]), [mx, my] = P((best[0] + best[1]) / 2);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const delay = animate ? idx * 0.22 : 0;
    const anim = animate ? `animation-delay:${delay}s` : 'animation:none;stroke-dashoffset:0';
    const nanim = animate ? `animation-delay:${delay + 1.1}s` : 'animation:none;opacity:1';
    html += `<line class="edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="--len:${len};${anim}"/>
      <line class="hit" data-e="${idx}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <circle class="node" data-e="${idx}" cx="${mx}" cy="${my}" r="${Math.min(6, len / 6)}" style="${nanim}"/>`;
  });
  svg.innerHTML = html;
}

const tooltip = $('#tooltip');
function edgeHTML(idx) {
  const [a, b] = SPREADS[state.spread].edges[idx];
  const A = state.picks.find((p) => p.slot === a), B = state.picks.find((p) => p.slot === b);
  const pos = SPREADS[state.spread].positions;
  const rel = relationOf(A, B);
  const ea = ELEMENTS[A.card.element], eb = ELEMENTS[B.card.element];
  return `<b>${pos[a].name}・${A.card.zh}</b> × <b>${pos[b].name}・${B.card.zh}</b>
    <div class="el">${ea.zh}（${ea.desc}）× ${eb.zh}（${eb.desc}）</div>${rel.text}
    ${rel.notes.map((n) => `<div class="note">✦ ${n}</div>`).join('')}`;
}
function showTooltip(idx, x, y) {
  tooltip.innerHTML = edgeHTML(idx);
  tooltip.hidden = false;
  const r = tooltip.getBoundingClientRect();
  tooltip.style.left = `${clamp(x - r.width / 2, 12, innerWidth - r.width - 12)}px`;
  tooltip.style.top = `${y - r.height - 16 < headerBottom() ? y + 18 : y - r.height - 16}px`;
}
function closeTooltip() { tooltip.hidden = true; }
$('#lines').addEventListener('pointerover', (e) => {
  const idx = e.target.dataset.e;
  if (idx !== undefined) showTooltip(+idx, e.clientX, e.clientY);
});
$('#lines').addEventListener('pointerout', (e) => { if (e.target.dataset.e !== undefined && e.pointerType === 'mouse') closeTooltip(); });
$('#lines').addEventListener('click', (e) => {
  const idx = e.target.dataset.e;
  if (idx !== undefined) { e.stopPropagation(); showTooltip(+idx, e.clientX, e.clientY); }
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#lines')) closeTooltip(); });

/* ================= 本機儲存 ================= */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};
const HISTORY_KEY = 'starTarot.history';
const CARD_BY_FILE = Object.fromEntries(CARDS.map((c) => [c.file, c]));

// 目前桌上的這一次占卜
function currentReading() {
  return {
    id: state.readingId, t: state.readingTime, spread: state.spread, topic: state.topic,
    question: $('#question').value.trim(), picks: state.picks,
  };
}
function saveHistory(r) {
  const list = store.get(HISTORY_KEY, []);
  list.unshift({
    id: r.id, t: r.t, spread: r.spread, topic: r.topic, question: r.question, note: '',
    picks: r.picks.map((p) => ({ file: p.card.file, reversed: p.reversed, slot: p.slot })),
  });
  store.set(HISTORY_KEY, list.slice(0, 200));
}
function readingFromHistory(h) {
  return { ...h, picks: h.picks.map((p) => ({ ...p, card: CARD_BY_FILE[p.file] })).filter((p) => p.card) };
}
function updateHistory(id, patch) {
  const list = store.get(HISTORY_KEY, []);
  const h = list.find((x) => x.id === id);
  if (h) { Object.assign(h, patch); store.set(HISTORY_KEY, list); }
}
const fmtTime = (t) => {
  const d = new Date(t), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${z(d.getMonth() + 1)}/${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
const esc = (str) => str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ================= 牌的詳細資訊 ================= */
const modal = $('#modal');
const mcard = modal.querySelector('.mcard');
bindHolo(modal.querySelector('.modal-card'), mcard);

function openModal(p, standalone, reading = currentReading()) {
  const { card, reversed } = p;
  const img = mcard.querySelector('img');
  img.src = thumb(card);
  const hi = new Image();
  hi.onload = () => { if (img.dataset.file === card.file) img.src = hi.src; };
  hi.src = full(card);
  img.dataset.file = card.file;
  mcard.classList.toggle('reversed', !!reversed);
  live.detach(mcard);
  live.attach(mcard, card);
  mcard.style.animation = 'none';
  void mcard.offsetWidth;
  mcard.style.animation = '';

  const el = ELEMENTS[card.element];
  const sp = SPREADS[reading.spread];
  const pos = standalone ? null : sp.positions[p.slot];
  const focus = standalone ? null : TOPICS[reading.topic].field;
  let rel = '';
  if (!standalone) {
    const items = sp.edges.filter((e) => e.includes(p.slot)).map(([a, b]) => {
      const other = reading.picks.find((q) => q.slot === (a === p.slot ? b : a));
      if (!other || (other.el && !other.el.classList.contains('flipped'))) return '';
      const r = relationOf(p, other);
      return `<div><b>與「${sp.positions[other.slot].name}」${other.card.zh}</b>：${r.text}${r.notes.map((n) => ` ${n}`).join('')}</div>`;
    }).join('');
    if (items) rel = `<section><h4>與其他牌的關係</h4><div class="rel">${items}</div></section>`;
  }
  // 選了問題類型就只顯示那個面向加上建議；綜合則顯示感情、事業與建議
  const TITLES = { love: '感情', work: '事業／學業', self: '自我成長', advice: '建議' };
  const fields = standalone ? ['love', 'work', 'self', 'advice'] : focus ? [focus, 'advice'] : ['love', 'work', 'advice'];
  const box = (field) => `<div class="${focus === field ? 'focus' : ''}"><h4>${focus === field ? TOPICS[reading.topic].zh : TITLES[field]}</h4><p>${card[field]}</p></div>`;
  const aspects = `
    <div class="aspects n${fields.length}">${fields.map(box).join('')}</div>
    ${!standalone && reversed ? '<p class="other">逆位時，以上面向的能量會受阻或向內收，請特別留意其中提醒的部分。</p>' : ''}`;
  const body = standalone
    ? `<p class="kw"><small>正位關鍵字</small>${card.up}</p>
       <section><h4>正位牌義</h4><p>${card.upText}</p></section>
       <section><h4>逆位牌義</h4><p><span class="rev-kw">${card.rev}</span><br>${card.revText}</p></section>
       ${aspects}`
    : `<p class="kw"><small>此刻的關鍵字</small>${kwOf(p)}</p>
       <section><h4>牌義</h4><p>${textOf(p)}</p></section>
       <section><h4>在「${pos.name}」的位置</h4><p>${positionText(p, sp)}</p></section>
       ${aspects}
       ${rel}
       <p class="other">${reversed ? '若轉為正位' : '若為逆位'}：${reversed ? card.up : card.rev}</p>`;
  modal.querySelector('.modal-text').innerHTML = `
    ${pos ? `<div class="pos">${pos.name} · ${pos.desc}</div>` : `<div class="pos">${card.major ? '大阿爾克那' : '小阿爾克那'}</div>`}
    <h2>${card.zh}</h2>
    <div class="en">${card.major ? card.number + ' · ' : ''}${card.en}</div>
    ${standalone ? '' : `<span class="tag ${reversed ? 'rev' : 'up'}">${orientOf(p)}</span>`}
    <span class="tag" style="color:${el.color}">${el.zh}元素 · ${el.desc}</span>
    ${body}`;
  modal.querySelector('.modal-text').scrollTop = 0;
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; live.detach(mcard); }
modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.close')) closeModal(); });

/* ================= 完整解讀 ================= */
const sheet = $('#sheet');
let sheetReading = null;

function openSheet(reading = currentReading(), back = null) {
  sheetReading = reading;
  const sp = SPREADS[reading.spread];
  const topic = TOPICS[reading.topic];
  const picks = [...reading.picks].sort((a, b) => a.slot - b.slot);
  const counts = {};
  picks.forEach((p) => (counts[p.card.element] = (counts[p.card.element] || 0) + 1));
  const notes = overviewNotes(picks, reading.spread);
  const story = storyParagraphs(picks, reading.spread, sp);
  const focus = topicReading(picks, reading.spread, sp, reading.topic);
  const posName = (p) => sp.positions[p.slot].name;
  const aspect = (field, title) => `
    <details ${(topic.field || 'love') === field ? 'open' : ''}><summary>${title}</summary>
      ${picks.map((p) => `<p><b>${posName(p)}・${p.card.zh}</b>：${p.card[field]}</p>`).join('')}
    </details>`;
  // 綜合才列出各面向；選了問題類型時，上面的「○○上的解讀」已經涵蓋
  const aspectOrder = topic.field ? [] : [['love', '感情面向'], ['work', '事業／學業面向']];
  const saved = reading.id && store.get(HISTORY_KEY, []).find((h) => h.id === reading.id);

  sheet.querySelector('.sheet-content').innerHTML = `
    ${back ? `<button class="back-btn" data-act="${back}">← 返回${back === 'calendar' ? '日曆' : '紀錄'}</button>` : ''}
    <h2>${sp.name}</h2>
    <p class="q">${reading.question ? `「${esc(reading.question)}」` : '你的牌陣'}</p>
    <p class="meta"><span>${topic.zh}</span>${reading.t ? `<span>${fmtTime(reading.t)}</span>` : ''}</p>
    <div class="sheet-tools"><button class="with-icon" data-act="share"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 7.5L12 3.5l4 4"/><path d="M6.5 11H5v9.5h14V11h-1.5"/></svg>存成圖片</button>${reading.spread === 'one' && back !== 'calendar' ? '<button class="with-icon" data-act="calendar"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>每日一牌日曆</button>' : ''}</div>

    <h3>整體能量</h3>
    <div class="elements">${Object.entries(counts).map(([k, v]) => `<span style="color:${ELEMENTS[k].color}">${ELEMENTS[k].zh} × ${v}</span>`).join('')}</div>
    ${notes.map((n) => `<p class="note-line">✦ ${n}</p>`).join('')}

    <h3>牌陣的故事</h3>
    ${story.map((t) => `<p class="story">${t}</p>`).join('')}

    ${focus ? `
    <h3>${topic.zh}上的解讀</h3>
    <p class="story">${focus.intro}</p>
    ${focus.items.map((it) => `<p class="note-line"><b>${it.label}</b>：${it.text}</p>`).join('')}` : ''}

    <h3>逐張解讀</h3>
    ${picks.map((p) => {
      const link = themeLink(p, picks, reading.spread);
      const tl = topicLine(p, reading.topic);
      return `
      <div class="row ${p.reversed ? 'reversed' : ''}" data-slot="${p.slot}">
        <img src="${thumb(p.card)}" alt="">
        <div>
          <div class="p">${posName(p)} · ${sp.positions[p.slot].desc}</div>
          <div class="n">${p.card.zh}<em style="color:${p.reversed ? '#ffb4b4' : '#ffe7a8'}">${orientOf(p)}</em></div>
          <div class="k">${kwOf(p)}</div>
          <p class="d">${textOf(p)}</p>
          <p class="d muted">${positionText(p, sp)}</p>
          ${tl ? `<p class="d topic">${topic.zh}：${tl}</p>` : ''}
          ${link ? `<p class="d link">${link}</p>` : ''}
          <span class="more">查看大圖與完整牌義 →</span>
        </div>
      </div>`;
    }).join('')}

    ${aspectOrder.map(([f, t]) => aspect(f, t)).join('')}

    <h3>給你的建議</h3>
    <ul class="advice">${picks.map((p) => `<li><b>${posName(p)}・${p.card.zh}</b>：${p.card.advice}</li>`).join('')}</ul>

    ${saved ? `
    <h3>回顧筆記</h3>
    <p class="other">過一段時間再回來，寫下事情後來的發展，看看塔羅說得準不準。</p>
    <textarea class="note" data-id="${saved.id}" maxlength="500" placeholder="後來怎麼樣了？">${esc(saved.note || '')}</textarea>` : ''}
    <p class="closing">塔羅映照的是此刻的能量，而不是無法改變的命運。把這些訊息當作一面鏡子，最後做決定的，永遠是你自己。</p>`;
  sheet.querySelector('.sheet-body').scrollTop = 0;
  sheet.hidden = false;
}

/* ================= 占卜紀錄 ================= */
function openHistory() {
  sheetReading = null;
  const list = store.get(HISTORY_KEY, []);
  sheet.querySelector('.sheet-content').innerHTML = `
    ${tabsHTML('history')}
    <h2>占卜紀錄</h2>
    <p class="q">${list.length ? `共 ${list.length} 次占卜，只存在這台裝置的瀏覽器裡。` : '還沒有紀錄。完成一次占卜後，就會自動存在這裡。'}</p>
    ${list.map((h) => {
      const r = readingFromHistory(h);
      const sp = SPREADS[r.spread];
      if (!sp) return '';
      const topic = TOPICS[r.topic] || TOPICS.general;
      return `
      <div class="hist" data-id="${h.id}">
        <div class="hist-cards">${[...r.picks].sort((a, b) => a.slot - b.slot).slice(0, 4).map((p) => `<img class="${p.reversed ? 'rev' : ''}" src="${thumb(p.card)}" alt="">`).join('')}</div>
        <div class="hist-info">
          <div class="p">${fmtTime(h.t)} · ${sp.name} · ${topic.zh}</div>
          <div class="hist-q">${h.question ? esc(h.question) : '（沒有寫下問題）'}</div>
          <div class="k">${r.picks.map((p) => p.card.zh + (p.reversed ? '（逆）' : '')).join('、')}</div>
          ${h.note ? `<div class="hist-note">筆記：${esc(h.note)}</div>` : ''}
        </div>
        <button class="del" data-del="${h.id}" aria-label="刪除這筆紀錄">✕</button>
      </div>`;
    }).join('')}
    ${list.length ? '<button class="clear" data-act="clear">清除全部紀錄</button>' : ''}`;
  sheet.querySelector('.sheet-body').scrollTop = 0;
  sheet.hidden = false;
}

/* ================= 每日一牌日曆 ================= */
const dayKey = (t) => {
  const d = new Date(t), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
// 每天的第一張每日一牌，以日期為 key
function dailyByDay() {
  const map = {};
  for (const h of store.get(HISTORY_KEY, [])) {
    if (h.spread !== 'one') continue;
    const k = dayKey(h.t);
    if (!map[k] || h.t < map[k].t) map[k] = h;
  }
  return map;
}
const todayDaily = () => dailyByDay()[dayKey(Date.now())];


const tabsHTML = (on) => `<div class="tabs">
  <button data-act="history" class="${on === 'history' ? 'on' : ''}">占卜紀錄</button>
  <button data-act="calendar" class="${on === 'calendar' ? 'on' : ''}">每日一牌日曆</button></div>`;

function streakDays(map) {
  const d = new Date();
  if (!map[dayKey(d)]) d.setDate(d.getDate() - 1); // 今天還沒抽，就從昨天算起
  let n = 0;
  while (map[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function monthNotes(entries) {
  const picks = entries.map((h) => readingFromHistory(h).picks[0]).filter(Boolean);
  if (!picks.length) return [];
  const notes = [];
  const count = (arr) => arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
  const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  const [el, elN] = top(count(picks.map((p) => p.card.element)));
  if (picks.length >= 3 && elN > 1) notes.push(`這個月以「${ELEMENTS[el].zh}」元素為主（${elN} 次），${ELEMENTS[el].desc}是你的主旋律。`);
  const minors = picks.filter((p) => !p.card.major);
  if (minors.length >= 2) {
    const [suit, n] = top(count(minors.map((p) => p.card.suit)));
    if (n > 1) notes.push(`最常出現的花色是${SUIT_DOMAIN[suit].zh}（${n} 次），生活重心落在${SUIT_DOMAIN[suit].area}。`);
  }
  const majors = picks.length - minors.length;
  if (majors) notes.push(`抽到 ${majors} 次大阿爾克那，${majors / picks.length >= 0.4 ? '這個月有不少深層的人生課題在發生。' : '偶爾有重要的訊息提醒你。'}`);
  const revs = picks.filter((p) => p.reversed).length;
  notes.push(revs ? `逆位出現 ${revs} 次，佔 ${Math.round((revs / picks.length) * 100)}%。${revs / picks.length > 0.5 ? '能量常常卡住，記得多照顧自己。' : ''}` : '這個月全部都是正位，能量很順暢！');
  Object.entries(count(picks.map((p) => p.card.zh))).filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .forEach(([name, n]) => notes.push(`「${name}」出現了 ${n} 次，它想告訴你的事值得多想一想。`));
  return notes;
}

let calMonth = null;
function openCalendar(step = 0) {
  sheetReading = null;
  const now = new Date();
  if (!calMonth || step === 0) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  else calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + step, 1);
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const map = dailyByDay();
  const days = new Date(y, m + 1, 0).getDate();
  const todayK = dayKey(now);
  const isThisMonth = y === now.getFullYear() && m === now.getMonth();
  const entries = [];
  let cells = '<div class="cal-dow">日</div><div class="cal-dow">一</div><div class="cal-dow">二</div><div class="cal-dow">三</div><div class="cal-dow">四</div><div class="cal-dow">五</div><div class="cal-dow">六</div>';
  cells += '<div></div>'.repeat(new Date(y, m, 1).getDay());
  for (let d = 1; d <= days; d++) {
    const k = dayKey(new Date(y, m, d));
    const h = map[k];
    const p = h && readingFromHistory(h).picks[0];
    if (p) entries.push(h);
    cells += `<div class="cal-day ${k === todayK ? 'today' : ''} ${p ? 'has' : ''}" ${p ? `data-id="${h.id}" title="${p.card.zh}${p.reversed ? '（逆位）' : ''}"` : ''}>
      <span>${d}</span>${p ? `<img class="${p.reversed ? 'rev' : ''}" src="${thumb(p.card)}" alt="${p.card.zh}">` : ''}</div>`;
  }
  const elems = {};
  entries.forEach((h) => { const c = readingFromHistory(h).picks[0]?.card; if (c) elems[c.element] = (elems[c.element] || 0) + 1; });
  const total = isThisMonth ? now.getDate() : days;
  const canNext = y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth());
  sheet.querySelector('.sheet-content').innerHTML = `
    ${tabsHTML('calendar')}
    <div class="cal-head">
      <button data-act="prev-month" aria-label="上個月">‹</button>
      <h2>${y} 年 ${m + 1} 月</h2>
      <button data-act="next-month" aria-label="下個月" ${canNext ? '' : 'disabled'}>›</button>
    </div>
    <div class="cal-stats">
      <div><b>${entries.length}</b><span>本月抽牌天數${total ? ` / ${total}` : ''}</span></div>
      <div><b>${streakDays(map)}</b><span>目前連續天數</span></div>
    </div>
    ${isThisMonth && !map[todayK] ? '<p class="cal-cta">今天還沒抽牌，回到起始頁選「每日一牌」來抽今天的指引吧 ✦</p>' : ''}
    <div class="cal-grid">${cells}</div>
    ${entries.length ? `
    <h3>本月能量</h3>
    <div class="elements">${Object.entries(elems).map(([k, v]) => `<span style="color:${ELEMENTS[k].color}">${ELEMENTS[k].zh} × ${v}</span>`).join('')}</div>
    ${monthNotes(entries).map((n) => `<p class="note-line">✦ ${n}</p>`).join('')}` : '<p class="other">這個月還沒有每日一牌的紀錄。</p>'}`;
  sheet.querySelector('.sheet-body').scrollTop = 0;
  sheet.hidden = false;
}

let noteTimer;
sheet.addEventListener('input', (e) => {
  if (!e.target.matches('textarea.note')) return;
  clearTimeout(noteTimer);
  const { id } = e.target.dataset, note = e.target.value;
  noteTimer = setTimeout(() => updateHistory(id, { note }), 400);
});
sheet.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'history') return openHistory();
  if (act === 'calendar') return openCalendar();
  if (act === 'prev-month' || act === 'next-month') return openCalendar(act === 'prev-month' ? -1 : 1);
  const day = e.target.closest('.cal-day[data-id]');
  if (day) {
    const h = store.get(HISTORY_KEY, []).find((x) => x.id === day.dataset.id);
    if (h) openSheet(readingFromHistory(h), 'calendar');
    return;
  }
  if (act === 'share') return openShare(sheetReading);
  if (act === 'clear') {
    if (confirm('確定要刪除所有占卜紀錄嗎？刪除後無法復原。')) { store.set(HISTORY_KEY, []); openHistory(); }
    return;
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    store.set(HISTORY_KEY, store.get(HISTORY_KEY, []).filter((h) => h.id !== del.dataset.del));
    return openHistory();
  }
  const hist = e.target.closest('.hist');
  if (hist) {
    const h = store.get(HISTORY_KEY, []).find((x) => x.id === hist.dataset.id);
    if (h) openSheet(readingFromHistory(h), 'history');
    return;
  }
  const row = e.target.closest('.row img, .row .n, .row .more')?.closest('.row');
  if (row && sheetReading) {
    sheet.hidden = true;
    openModal(sheetReading.picks.find((p) => p.slot === +row.dataset.slot), false, sheetReading);
    return;
  }
  if (e.target === sheet || e.target.closest('.close')) sheet.hidden = true;
});

/* ================= 存成圖片 ================= */
const share = $('#share');
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

async function renderShareImage(reading) {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const sp = SPREADS[reading.spread];
  const topic = TOPICS[reading.topic];
  const picks = [...reading.picks].sort((a, b) => a.slot - b.slot);
  const story = storyParagraphs(picks, reading.spread, sp);
  const focus = topicReading(picks, reading.spread, sp, reading.topic);
  const SERIF = '"Noto Serif TC", serif', DISPLAY = '"Cinzel", serif';

  // 先載入畫面上會用到的字（Google Fonts 只會下載用到的字）
  const allText = [sp.name, topic.zh, reading.question, ...story, focus?.intro || '',
    ...picks.flatMap((p) => [p.card.zh, kwOf(p), sp.positions[p.slot].name]), '正位逆位星空塔羅牌陣的故事上的解讀「」…·'].join('');
  try {
    await Promise.all([document.fonts.load(`40px ${SERIF}`, allText), document.fonts.load(`600 40px ${SERIF}`, allText), document.fonts.load(`500 40px ${DISPLAY}`, 'STAR TAROT')]);
  } catch { /* 字型載入失敗就用系統字 */ }

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#120c33'); bg.addColorStop(0.55, '#0a0820'); bg.addColorStop(1, '#170d2a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  [[220, 380, 520, 'rgba(120,70,190,.30)'], [880, 1300, 560, 'rgba(50,100,190,.26)']].forEach(([x, y, r, col]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  let seed = (reading.t || 1) % 2147483647 || 7;
  const prng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 260; i++) {
    const s = 4 + prng() * 14;
    ctx.globalAlpha = 0.2 + prng() * 0.7;
    ctx.drawImage(SPRITES.star, prng() * W - s / 2, prng() * H - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 標題
  ctx.textAlign = 'center';
  const gold = ctx.createLinearGradient(300, 0, 780, 0);
  gold.addColorStop(0, '#f8e3a1'); gold.addColorStop(0.5, '#c9a14a'); gold.addColorStop(1, '#fff1c4');
  ctx.fillStyle = gold;
  ctx.font = `500 54px ${DISPLAY}`;
  ctx.letterSpacing = '12px';
  ctx.fillText('STAR TAROT', W / 2, 120);
  ctx.letterSpacing = '6px';
  ctx.fillStyle = '#b8b0d0';
  ctx.font = `30px ${SERIF}`;
  ctx.fillText(`星空塔羅 · ${sp.name} · ${topic.zh}`, W / 2, 180);
  ctx.letterSpacing = '0px';
  let y = 250;
  if (reading.question) {
    ctx.fillStyle = '#f4ecd8';
    ctx.font = `40px ${SERIF}`;
    wrapText(ctx, `「${reading.question}」`, 900).slice(0, 2).forEach((l) => { ctx.fillText(l, W / 2, y); y += 58; });
  }
  y += 30;

  // 牌
  const imgs = await Promise.all(picks.map((p) => loadImg(thumb(p.card))));
  let rows;
  if (reading.spread === 'theme') rows = [[{ i: 0, w: 280 }, { i: 1, w: 214 }, { i: 2, w: 214 }, { i: 3, w: 214 }]];
  else if (picks.length === 1) rows = [[{ i: 0, w: 400 }]];
  else rows = [picks.slice(0, 5).map((_, i) => ({ i, w: picks.length <= 4 ? 214 : 176 })), picks.slice(5).map((_, i) => ({ i: i + 5, w: 176 }))].filter((r) => r.length);
  const gap = 26;
  for (const row of rows) {
    const total = row.reduce((a, b) => a + b.w, 0) + gap * (row.length - 1);
    let x = (W - total) / 2;
    const rowH = Math.max(...row.map((r) => r.w * CARD_RATIO));
    for (const { i, w } of row) {
      const h = w * CARD_RATIO, p = picks[i], top = y + (rowH - h) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(232,200,119,.45)'; ctx.shadowBlur = 40;
      ctx.beginPath(); ctx.roundRect(x, top, w, h, w * 0.06);
      ctx.fillStyle = '#e9d9b5'; ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, top, w, h, w * 0.06); ctx.clip();
      if (imgs[i]) {
        if (p.reversed) { ctx.translate(x + w / 2, top + h / 2); ctx.rotate(Math.PI); ctx.drawImage(imgs[i], -w / 2, -h / 2, w, h); } else ctx.drawImage(imgs[i], x, top, w, h);
      }
      ctx.restore();
      ctx.textAlign = 'center';
      const cx = x + w / 2;
      ctx.fillStyle = '#e8c877';
      ctx.font = `${w > 200 ? 26 : 22}px ${SERIF}`;
      ctx.fillText(sp.positions[p.slot].name, cx, y + rowH + 40);
      ctx.fillStyle = '#f4ecd8';
      ctx.font = `600 ${w > 200 ? 30 : 24}px ${SERIF}`;
      ctx.fillText(p.card.zh, cx, y + rowH + (w > 200 ? 80 : 72));
      ctx.fillStyle = p.reversed ? '#ffb4b4' : '#ffe7a8';
      ctx.font = `${w > 200 ? 24 : 20}px ${SERIF}`;
      ctx.fillText(orientOf(p), cx, y + rowH + (w > 200 ? 114 : 100));
      x += w + gap;
    }
    y += rowH + (row[0].w > 200 ? 190 : 150);
  }

  // 解讀文字
  const textX = 90, textW = W - 180, bottom = H - 150;
  const para = (title, text) => {
    if (y > bottom - 120) return;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8c877';
    ctx.font = `600 32px ${SERIF}`;
    ctx.fillText(`✧ ${title}`, textX, y); y += 56;
    ctx.fillStyle = '#f4ecd8';
    ctx.font = `30px ${SERIF}`;
    let lines = wrapText(ctx, text, textW);
    const room = Math.floor((bottom - y) / 50);
    if (lines.length > room) { lines = lines.slice(0, Math.max(room, 0)); if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + '…'; }
    lines.forEach((l) => { ctx.fillText(l, textX, y); y += 50; });
    y += 30;
  };
  if (focus) para(`${topic.zh}上的解讀`, focus.intro);
  para('牌陣的故事', story.slice(reading.spread === 'theme' ? 1 : 0).join(''));
  if (picks.length === 1 && !focus) {
    para('感情', picks[0].card.love);
    para('事業／學業', picks[0].card.work);
  }
  const key = picks.find((q) => ['未來', '結果', '今日指引'].includes(sp.positions[q.slot].name)) || picks[picks.length - 1];
  para('給你的建議', key.card.advice);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8d86a8';
  ctx.font = `24px ${SERIF}`;
  ctx.fillText(`${reading.t ? fmtTime(reading.t) + ' · ' : ''}✦ 星空塔羅 Star Tarot ✦`, W / 2, H - 80);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

let shareFile = null;
async function openShare(reading) {
  if (!reading) return;
  share.hidden = false;
  const img = share.querySelector('img');
  img.removeAttribute('src');
  share.querySelector('.share-status').textContent = '正在產生圖片…';
  const blob = await renderShareImage(reading);
  shareFile = new File([blob], `star-tarot-${new Date(reading.t || Date.now()).toISOString().slice(0, 10)}.png`, { type: 'image/png' });
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  const canShare = navigator.canShare && navigator.canShare({ files: [shareFile] });
  share.querySelector('[data-act="native"]').hidden = !canShare;
  share.querySelector('.share-status').textContent = canShare ? '可以直接分享，或下載到裝置。手機上也能長按圖片儲存。' : '下載後就能分享到 IG 或傳給朋友。';
}
share.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'native' && shareFile) {
    try { await navigator.share({ files: [shareFile], title: '星空塔羅' }); } catch { /* 使用者取消分享 */ }
  } else if (act === 'download' && shareFile) {
    const a = document.createElement('a');
    a.href = share.querySelector('img').src;
    a.download = shareFile.name;
    a.click();
  } else if (e.target === share || e.target.closest('.close')) {
    share.hidden = true;
  }
});

/* ================= 牌卡畫廊 ================= */
const gallery = (() => {
  const root = $('#gallery'), ring = $('#ring');
  let built = false, rot = 0, vel = 0, R = 0, raf = 0, drag = null;
  const ROWS = 3, PER = CARDS.length / ROWS;

  function build() {
    const gw = clamp(Math.min(innerWidth * 0.085, (innerHeight - 190) / 3.9 / CARD_RATIO), 54, 112);
    const gh = gw * CARD_RATIO;
    R = (PER * gw * 1.16) / (2 * Math.PI);
    if (!built) {
      ring.innerHTML = CARDS.map((c, i) => `<div class="gcard" data-i="${i}">
        <div class="face front"><img src="${thumb(c)}" alt="${c.zh}" draggable="false" loading="lazy"></div>
        <div class="face back"></div></div>`).join('');
      built = true;
    }
    [...ring.children].forEach((el, i) => {
      const row = Math.floor(i / PER), j = i % PER;
      const ang = (j * 360) / PER + row * (180 / PER);
      el.style.width = `${gw}px`;
      el.style.height = `${gh}px`;
      el.style.left = `${-gw / 2}px`;
      el.style.top = `${-gh / 2 + (row - 1) * gh * 1.1}px`;
      el.style.transform = `rotateY(${ang}deg) translateZ(${R}px)`;
    });
  }
  function frame() {
    if (!drag) { vel += (0.06 - vel) * 0.02; rot += vel; }
    ring.style.transform = `translateZ(${-R}px) rotateX(-6deg) rotateY(${-rot}deg)`;
    raf = requestAnimationFrame(frame);
  }
  root.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, last: e.clientX, moved: 0 };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.last;
    drag.last = e.clientX;
    drag.moved += Math.abs(dx);
    rot -= dx * 0.25;
    vel = -dx * 0.25;
  });
  root.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (d && d.moved < 6) {
      root.releasePointerCapture(e.pointerId);
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gcard');
      if (hit) openModal({ card: CARDS[+hit.dataset.i], reversed: false }, true);
    }
  });
  return {
    open() { build(); root.hidden = false; document.body.classList.add('gallery-mode'); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    close() { root.hidden = true; document.body.classList.remove('gallery-mode'); cancelAnimationFrame(raf); },
    get isOpen() { return !root.hidden; },
    resize() { if (built) build(); },
  };
})();

/* ================= 事件 ================= */
$('#question').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.currentTarget.blur(); });
$('#revealAllBtn').addEventListener('click', revealAll);
$('#homeBtn').addEventListener('click', () => {
  if (state.phase === 'idle') showHome();
  else resetReading(true);
});
$('#readingBtn').addEventListener('click', () => openSheet());
$('#shareBtn').addEventListener('click', () => openShare(currentReading()));
$('#historyBtn').addEventListener('click', openHistory);
// 「靈感」按鈕：依目前分類輪流填入建議問題
let lastIdea = '';
const ideaIdx = {};
$('#ideaBtn').addEventListener('click', () => {
  const list = QUESTION_IDEAS[state.topic];
  const i = (ideaIdx[state.topic] = ((ideaIdx[state.topic] ?? Math.floor(rand() * list.length)) + 1) % list.length);
  const q = $('#question');
  q.value = lastIdea = list[i];
  q.classList.remove('flash');
  void q.offsetWidth;
  q.classList.add('flash');
});
function setTopic(key) {
  if (key !== state.topic && $('#question').value === lastIdea) $('#question').value = ''; // 換情境時清掉自動填入的舊靈感
  state.topic = TOPICS[key] ? key : 'general';
}
$('#againBtn').addEventListener('click', () => resetReading(false));
$('#galleryBtn').addEventListener('click', () => (gallery.isOpen ? gallery.close() : gallery.open()));
const SOUND_ICON = {
  on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.4L12 6v12l-4.6-3.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>',
  off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.4L12 6v12l-4.6-3.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
};
$('#soundBtn').addEventListener('click', (e) => {
  state.muted = !state.muted;
  e.currentTarget.innerHTML = state.muted ? SOUND_ICON.off : SOUND_ICON.on;
  e.currentTarget.classList.toggle('off', state.muted);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { wheel.close(); closeModal(); sheet.hidden = true; share.hidden = true; closeTooltip(); }
});

// 搖一搖洗牌
let lastShake = 0, lastAcc = null;
addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  if (lastAcc) {
    const d = Math.abs(a.x - lastAcc.x) + Math.abs(a.y - lastAcc.y) + Math.abs(a.z - lastAcc.z);
    const now = Date.now();
    if (d > 28 && now - lastShake > 2500 && !gallery.isOpen && modal.hidden) {
      lastShake = now;
      // 還沒抽任何牌時搖一搖，就重新洗牌
      if (state.phase === 'picking' && !state.picks.length) {
        ring.hide();
        startShuffle();
      }
    }
  }
  lastAcc = { x: a.x, y: a.y, z: a.z };
});

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    sky.init();
    fx.resize();
    gallery.resize();
    if (state.phase === 'idle') state.els.forEach((el, i) => place(el, stackPos(i)));
    if (state.phase === 'picking' || state.phase === 'dealing') ring.layout();
    if (state.phase !== 'shuffling') relayoutPlaced();
    updateHint();
    drawLines(false);
  }, 150);
});

buildStack();
renderSlots();
showHome();
