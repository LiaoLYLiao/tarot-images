'use strict';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;
const CARD_RATIO = 1.9;

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
const thumb = (card) => `thumbs/${card.file}.jpg`;
const full = (card) => `${card.file}.jpeg`;

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
  muted: false,
};

/* ================= 牌背 ================= */
(function makeCardBack() {
  const star = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * i) / 8 - Math.PI / 2;
    const r = i % 2 ? 10 : i % 4 === 0 ? 46 : 28;
    star.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(190 + r * Math.sin(a)).toFixed(1)}`);
  }
  let seed = 7;
  const prng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let dots = '';
  for (let i = 0; i < 46; i++) {
    const x = 20 + prng() * 160, y = 22 + prng() * 336;
    if (Math.hypot(x - 100, y - 190) < 70) continue;
    dots += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='${(0.4 + prng() * 1.1).toFixed(2)}' fill='#f8e3a1' opacity='${(0.35 + prng() * 0.6).toFixed(2)}'/>`;
  }
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * i) / 6;
    rays += `<line x1='${100 + 12 * Math.cos(a)}' y1='${318 + 12 * Math.sin(a)}' x2='${100 + 18 * Math.cos(a)}' y2='${318 + 18 * Math.sin(a)}'/>`;
  }
  const corners = [[24, 24], [176, 24], [24, 356], [176, 356]]
    .map(([x, y]) => `<path d='M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z' fill='url(#au)'/>`).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 380'>
<defs>
<radialGradient id='bg' cx='50%' cy='50%' r='75%'><stop offset='0' stop-color='#2d2266'/><stop offset='.6' stop-color='#151036'/><stop offset='1' stop-color='#09081f'/></radialGradient>
<linearGradient id='au' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fbe9b0'/><stop offset='.5' stop-color='#c9a14a'/><stop offset='1' stop-color='#f3d68a'/></linearGradient>
<radialGradient id='halo'><stop offset='0' stop-color='#f8e3a1' stop-opacity='.45'/><stop offset='1' stop-color='#f8e3a1' stop-opacity='0'/></radialGradient>
</defs>
<rect width='200' height='380' rx='12' fill='url(#bg)'/>
${dots}
<rect x='9' y='9' width='182' height='362' rx='8' fill='none' stroke='url(#au)' stroke-width='2'/>
<rect x='15' y='15' width='170' height='350' rx='5' fill='none' stroke='url(#au)' stroke-width='.6' opacity='.7'/>
${corners}
<circle cx='100' cy='190' r='70' fill='url(#halo)'/>
<circle cx='100' cy='190' r='62' fill='none' stroke='url(#au)' stroke-width='1'/>
<circle cx='100' cy='190' r='55' fill='none' stroke='url(#au)' stroke-width='.6' stroke-dasharray='2 4'/>
<polygon points='${star.join(' ')}' fill='url(#au)'/>
<circle cx='100' cy='190' r='5' fill='#151036'/>
<circle cx='100' cy='62' r='15' fill='url(#au)'/><circle cx='107' cy='57' r='13' fill='#1a1440'/>
<circle cx='100' cy='318' r='8' fill='url(#au)'/>
<g stroke='#e8c877' stroke-width='1.4' stroke-linecap='round'>${rays}</g>
<line x1='100' y1='92' x2='100' y2='122' stroke='url(#au)' stroke-width='.6'/>
<line x1='100' y1='258' x2='100' y2='290' stroke='url(#au)' stroke-width='.6'/>
</svg>`;
  document.documentElement.style.setProperty('--back', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
})();

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
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  init();
  requestAnimationFrame(frame);
  return { init };
})();

/* ================= 粒子特效 ================= */
const fx = (() => {
  const canvas = $('#fx');
  let ctx = fitCanvas(canvas);
  let parts = [], rings = [];
  const kinds = ['gold', 'gold', 'gold', 'star', 'rose', 'cyan'];

  function burst(x, y, n = 70, power = 7) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, v = power * (0.3 + rand());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.06, drag: 0.95, life: 1, decay: 0.008 + rand() * 0.014, s: 6 + rand() * 16, k: kinds[(rand() * kinds.length) | 0] });
    }
    rings.push({ x, y, r: 10, life: 1 });
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
    ctx.globalAlpha = 1;
    if (state.phase === 'idle' && rand() < 0.12 && state.els.length) {
      const s = stackPos(0);
      mote(s.x + (rand() - 0.5) * s.w * 1.6, s.y + s.h * 0.4 * rand());
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { burst, sparkle, resize: () => (ctx = fitCanvas(canvas)) };
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
    whoosh() { if (!state.muted) { ensure(); noise(0.6, 400, 2400, 0.18); } },
  };
})();

/* ================= 版面計算 ================= */
const headerBottom = () => $('#top').getBoundingClientRect().bottom;

function stackPos(i) {
  const w = clamp(innerWidth * 0.16, 96, 150);
  return { x: innerWidth / 2, y: innerHeight * 0.42 - i * 0.25, w, h: w * CARD_RATIO, rot: 0 };
}

function fanGeom(n = state.fanN || CARDS.length) {
  const fw = clamp(innerWidth * 0.06, 40, 78), fh = fw * CARD_RATIO;
  const half = Math.min(innerWidth * 0.45 - fw / 2, 700);
  const sag = Math.min(110, half * 0.42);
  const theta = 2 * Math.atan(sag / half);
  const R = half / Math.sin(theta);
  const topY = innerHeight - fh / 2 - sag - 24;
  return {
    n, fw, fh, theta, R, cx: innerWidth / 2, cy: topY + R,
    top: topY - fh / 2,
    pos(k) {
      const a = n > 1 ? -theta + (2 * theta * k) / (n - 1) : 0;
      return { x: this.cx + R * Math.sin(a), y: this.cy - R * Math.cos(a), w: fw, h: fh, rot: a / DEG };
    },
  };
}

function spreadArea() {
  const top = headerBottom() + 18;
  const bottom = state.phase === 'reading' ? innerHeight - 84 : fanGeom().top - 46;
  return { x: 16, y: top, w: innerWidth - 32, h: Math.max(120, bottom - top) };
}

function fitPositions(pts, area) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    const hx = (p.rot ? CARD_RATIO / 2 : 0.5) * p.s, hy = (p.rot ? 0.5 / CARD_RATIO : 0.5) * p.s;
    minX = Math.min(minX, p.x - hx); maxX = Math.max(maxX, p.x + hx);
    minY = Math.min(minY, p.y - hy); maxY = Math.max(maxY, p.y + hy);
  }
  const pad = 12; // 上方牌位標籤的空間
  const W = Math.min(area.w / (maxX - minX), (area.h - pad) / ((maxY - minY) * CARD_RATIO), 250);
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

function place(el, p, lift = true) {
  el.style.width = `${p.w}px`;
  el.style.height = `${p.h}px`;
  el.style.transform = `translate3d(${p.x - p.w / 2}px, ${p.y - p.h / 2}px, 0) rotate(${p.rot}deg)` + (lift ? ' translateY(var(--lift, 0px))' : '');
}

/* ================= 牌位與標籤 ================= */
function renderSlots() {
  const slots = $('#slots'), labels = $('#labels');
  const show = state.phase === 'picking' || state.phase === 'reading';
  const positions = SPREADS[state.spread].positions;
  if (slots.children.length !== positions.length || slots.dataset.spread !== state.spread) {
    slots.innerHTML = labels.innerHTML = '';
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
  [...labels.children].forEach((l, i) => {
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
  if (state.phase === 'picking' && state.picks.length < positions.length) {
    const p = positions[state.picks.length];
    const from = p.pool === 'major' ? `從 ${state.fanN} 張大阿爾克那中，` : p.pool === 'minor' ? `從 ${state.fanN} 張小阿爾克那中，` : '';
    hint.textContent = `${from}憑直覺選出第 ${state.picks.length + 1} 張牌 · ${p.name}`;
    hint.style.top = `${fanGeom().top - 38}px`;
    hint.style.opacity = 1;
  } else if (state.phase === 'shuffling') {
    hint.textContent = '洗牌中，讓問題在心中沉澱…';
    hint.style.top = `${innerHeight * 0.42 + stackPos(0).h / 2 + 30}px`;
    hint.style.opacity = 1;
  } else {
    hint.style.opacity = 0;
  }
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

function buildStack() {
  const table = $('#table');
  table.innerHTML = '';
  state.els = CARDS.map((_, i) => {
    const el = makeCard();
    el.classList.add('stack');
    el.style.transitionDuration = '0s';
    place(el, stackPos(i));
    table.appendChild(el);
    el.addEventListener('click', onCardClick);
    return el;
  });
  requestAnimationFrame(() => state.els.forEach((el) => (el.style.transitionDuration = '')));
}

function onCardClick(e) {
  const el = e.currentTarget;
  if (state.phase === 'idle') startShuffle();
  else if (state.phase === 'picking' && el.classList.contains('fan')) pick(el);
  else if (el.classList.contains('placed') && el.classList.contains('flipped')) {
    openModal(state.picks.find((p) => p.el === el));
  }
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
  if (state.phase === 'reading' || state.picks.length) return resetReading(true);
  const today = state.spread === 'one' && todayDaily();
  if (today) return openSheet(readingFromHistory(today), 'calendar');
  sound.unlock();
  askMotion();
  state.phase = 'shuffling';
  state.deck = shuffled(CARDS).map((card) => ({ card, reversed: rand() < 0.35 }));
  $('#intro').classList.add('gone');
  $('#question').blur();
  renderSlots();

  const els = state.els;
  els.forEach((el) => {
    el.classList.remove('fan', 'hot');
    el.classList.add('stack');
    el.style.opacity = 1;
    el.style.pointerEvents = '';
  });
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
      place(el, { ...stackPos(i), x: s.x + side * s.w * (0.55 + rand() * 0.15), y: s.y - i * 0.25 + (rand() - 0.5) * 10, rot: side * (6 + rand() * 6) });
    });
    await sleep(430);
    const table = $('#table');
    shuffled(els).forEach((el) => table.appendChild(el));
    state.els = [...table.children];
    state.els.forEach((el, i) => { el.style.transitionDelay = `${i * 2}ms`; place(el, stackPos(i)); });
    await sleep(420);
  }

  state.els.forEach((el, k) => (el.dataset.k = k));
  await sleep(dealFan(true));
  state.phase = 'picking';
  renderSlots();
  updateHint();
}

const poolOf = (slot) => SPREADS[state.spread].positions[slot]?.pool;
const inPool = (card, pool) => !pool || (pool === 'major') === card.major;

// 依下一個牌位需要的牌池（大牌／小牌／全部）展開扇形，其餘的牌收到扇形下方藏起來。
// 回傳動畫所需的毫秒數。
function dealFan(animate) {
  const pool = poolOf(state.picks.length);
  const fanEls = [], restEls = [];
  state.els.forEach((el) => {
    if (el.classList.contains('flying') || el.classList.contains('placed')) return;
    (inPool(state.deck[+el.dataset.k].card, pool) ? fanEls : restEls).push(el);
  });
  state.fanN = fanEls.length;
  const fan = fanGeom();
  const hidden = { x: fan.cx, y: fan.top + fan.fh, w: fan.fw, h: fan.fh, rot: 0 };
  restEls.forEach((el) => {
    el.classList.remove('fan', 'hot', 'stack');
    el.style.transitionDuration = animate ? '.6s' : '0s';
    el.style.transitionDelay = '0ms';
    el.style.opacity = 0;
    el.style.pointerEvents = 'none';
    place(el, hidden);
  });
  fanEls.forEach((el, f) => {
    el.dataset.f = f;
    el.classList.remove('stack');
    el.classList.add('fan');
    el.style.opacity = 1;
    el.style.pointerEvents = '';
    el.style.transitionDuration = animate ? '.8s' : '.3s';
    el.style.transitionDelay = animate ? `${f * 9}ms` : '0ms';
    place(el, fan.pos(f));
  });
  if (!animate) return 0;
  sound.whoosh();
  for (let f = 0; f < fan.n; f += 3) {
    setTimeout(() => { const p = fan.pos(f); fx.sparkle(p.x, p.y - fan.fh / 2, 2); }, 200 + f * 9);
  }
  const ms = 800 + fan.n * 9;
  setTimeout(() => fanEls.forEach((el) => {
    if (!el.classList.contains('fan')) return;
    el.style.transitionDuration = '.3s';
    el.style.transitionDelay = '0ms';
  }), ms);
  return ms;
}

/* ================= 抽牌 ================= */
async function pick(el) {
  const positions = SPREADS[state.spread].positions;
  if (state.dealing || state.picks.length >= positions.length) return;
  const slot = state.picks.length;
  const { card, reversed } = state.deck[+el.dataset.k];
  if (!inPool(card, poolOf(slot))) return;
  const p = { card, reversed, el, slot };
  state.picks.push(p);

  const img = el.querySelector('img');
  img.src = thumb(card);
  el.classList.remove('fan', 'hot');
  el.classList.add('flying');
  el.classList.toggle('reversed', reversed);
  el.style.setProperty('--lift', '0px');
  el.style.transitionDuration = '1s';
  place(el, state.layout[slot]);
  sound.whoosh();
  renderSlots();
  updateHint();
  if (slot + 1 < positions.length && poolOf(slot + 1) !== poolOf(slot)) {
    // 換牌池：剩下的牌收起來，換另一組牌展開
    state.dealing = true;
    $('#hint').style.opacity = 0;
    setTimeout(async () => {
      await sleep(dealFan(true));
      state.dealing = false;
      updateHint();
    }, 650);
  }

  const t0 = performance.now();
  (function trail() {
    const r = el.getBoundingClientRect();
    fx.sparkle(r.left + r.width / 2, r.top + r.height / 2, 3);
    if (performance.now() - t0 < 900) requestAnimationFrame(trail);
  })();

  await sleep(1000);
  el.classList.remove('flying');
  el.classList.add('placed');
  await Promise.race([img.decode().catch(() => {}), sleep(2500)]);
  el.classList.add('flipped');
  await sleep(260);
  const r = el.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2);
  sound.chime(slot);
  el.classList.add('shine');
  bindHolo(el, el);

  state.revealed++;
  if (state.revealed === positions.length) {
    await sleep(900);
    enterReading();
  }
}

function enterReading() {
  state.phase = 'reading';
  state.readingTime = Date.now();
  state.readingId = state.readingTime.toString(36) + Math.floor(rand() * 1e6).toString(36);
  saveHistory(currentReading());
  const fan = fanGeom();
  state.els.forEach((el, i) => {
    if (!el.classList.contains('fan')) return;
    el.classList.remove('fan');
    el.style.pointerEvents = 'none';
    el.style.transitionDuration = '.9s';
    el.style.transitionDelay = `${Math.abs(i - fan.n / 2) * 4}ms`;
    const p = fan.pos(+el.dataset.f);
    place(el, { ...p, y: p.y + innerHeight * 0.5 });
    el.style.opacity = 0;
  });
  const leftovers = state.els.filter((el) => !el.classList.contains('placed'));
  setTimeout(() => leftovers.forEach((el) => el.remove()), 1600);
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

async function resetReading(reshuffle) {
  if (state.phase === 'shuffling') return;
  closeTooltip();
  $('#lines').innerHTML = '';
  $('#actions').hidden = true;
  state.els.forEach((el) => {
    el.style.transitionDuration = '.5s';
    el.style.opacity = 0;
    el.style.pointerEvents = 'none';
  });
  state.phase = 'idle';
  state.picks = [];
  state.revealed = 0;
  state.fanN = 0;
  renderSlots();
  updateHint();
  await sleep(450);
  buildStack();
  if (reshuffle) {
    await sleep(80);
    startShuffle();
  } else {
    $('#intro').classList.remove('gone');
    updateIntro();
  }
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
  const box = (field, title) => `<div class="${focus === field ? 'focus' : ''}"><h4>${title}</h4><p>${card[field]}</p></div>`;
  const aspects = `
    <div class="aspects">
      ${box('love', '💗 感情')}${box('work', '💼 事業／學業')}${box('advice', '✦ 建議')}
    </div>
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
function closeModal() { modal.hidden = true; }
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
  const aspectOrder = [['love', '💗 感情面向'], ['work', '💼 事業／學業面向']];
  if (topic.field === 'work') aspectOrder.reverse();
  const saved = reading.id && store.get(HISTORY_KEY, []).find((h) => h.id === reading.id);

  sheet.querySelector('.sheet-content').innerHTML = `
    ${back ? `<button class="back-btn" data-act="${back}">← 返回${back === 'calendar' ? '日曆' : '紀錄'}</button>` : ''}
    <h2>${sp.name}</h2>
    <p class="q">${reading.question ? `「${esc(reading.question)}」` : '你的牌陣'}</p>
    <p class="meta"><span>${topic.icon} ${topic.zh}</span>${reading.t ? `<span>${fmtTime(reading.t)}</span>` : ''}</p>
    <div class="sheet-tools"><button data-act="share">📤 存成圖片</button>${reading.spread === 'one' && back !== 'calendar' ? '<button data-act="calendar">📅 每日一牌日曆</button>' : ''}</div>

    <h3>整體能量</h3>
    <div class="elements">${Object.entries(counts).map(([k, v]) => `<span style="color:${ELEMENTS[k].color}">${ELEMENTS[k].zh} × ${v}</span>`).join('')}</div>
    ${notes.map((n) => `<p class="note-line">✦ ${n}</p>`).join('')}

    <h3>牌陣的故事</h3>
    ${story.map((t) => `<p class="story">${t}</p>`).join('')}

    ${focus ? `
    <h3>${topic.icon} ${topic.zh}上的解讀</h3>
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
          ${tl ? `<p class="d topic">${topic.icon} ${topic.zh}：${tl}</p>` : ''}
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
          <div class="p">${fmtTime(h.t)} · ${sp.name} · ${topic.icon} ${topic.zh}</div>
          <div class="hist-q">${h.question ? esc(h.question) : '（沒有寫下問題）'}</div>
          <div class="k">${r.picks.map((p) => p.card.zh + (p.reversed ? '（逆）' : '')).join('、')}</div>
          ${h.note ? `<div class="hist-note">🖊 ${esc(h.note)}</div>` : ''}
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

function updateIntro() {
  const done = state.spread === 'one' && todayDaily();
  $('#shuffleBtn').textContent = done ? '✦ 查看今天的牌' : '✦ 洗牌';
  $('#question').hidden = !!done;
  $('#topics').hidden = !!done;
  $('#intro .sub').textContent = done ? '每日一牌一天只能抽一張，明天再來吧 · 可以在 📖 裡看日曆' : '點擊牌堆或按下洗牌 · 手機也可以搖一搖';
}

const tabsHTML = (on) => `<div class="tabs">
  <button data-act="history" class="${on === 'history' ? 'on' : ''}">📖 占卜紀錄</button>
  <button data-act="calendar" class="${on === 'calendar' ? 'on' : ''}">📅 每日一牌日曆</button></div>`;

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
    ${isThisMonth && !map[todayK] ? '<p class="cal-cta">今天還沒抽牌，切換到「每日一牌」來抽今天的指引吧 ✦</p>' : ''}
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
  else rows = [picks.slice(0, 5).map((_, i) => ({ i, w: 176 })), picks.slice(5).map((_, i) => ({ i: i + 5, w: 176 }))];
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
$('#shuffleBtn').addEventListener('click', startShuffle);
$('#question').addEventListener('keydown', (e) => { if (e.key === 'Enter') startShuffle(); });
$('#readingBtn').addEventListener('click', () => openSheet());
$('#shareBtn').addEventListener('click', () => openShare(currentReading()));
$('#historyBtn').addEventListener('click', openHistory);
function setTopic(key) {
  state.topic = TOPICS[key] ? key : 'general';
  document.querySelectorAll('#topics button').forEach((b) => b.classList.toggle('on', b.dataset.topic === state.topic));
}
$('#topics').innerHTML = Object.entries(TOPICS).map(([k, t]) => `<button data-topic="${k}">${t.icon} ${t.zh}</button>`).join('');
$('#topics').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  setTopic(b.dataset.topic);
  store.set('starTarot.topic', state.topic);
});
setTopic(store.get('starTarot.topic', 'general'));
$('#againBtn').addEventListener('click', () => resetReading(false));
$('#galleryBtn').addEventListener('click', () => (gallery.isOpen ? gallery.close() : gallery.open()));
$('#soundBtn').addEventListener('click', (e) => {
  state.muted = !state.muted;
  e.currentTarget.textContent = state.muted ? '🔇' : '🔊';
});
$('#spreadPicker').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || state.phase === 'shuffling' || state.dealing || b.dataset.spread === state.spread) return;
  if (state.picks.some((p) => p.el.classList.contains('flying') || !p.el.classList.contains('flipped'))) return;
  document.querySelectorAll('#spreadPicker button').forEach((x) => x.classList.toggle('on', x === b));
  const wasActive = state.phase !== 'idle';
  state.spread = b.dataset.spread;
  const locked = state.spread === 'one' && todayDaily();
  if (state.picks.length || state.phase === 'reading' || (locked && wasActive)) resetReading(false);
  else if (wasActive) { renderSlots(); dealFan(true); updateHint(); }
  updateIntro();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); sheet.hidden = true; share.hidden = true; closeTooltip(); }
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
      if (state.phase === 'idle' || (state.phase === 'picking' && !state.picks.length)) {
        if (state.phase === 'picking') { state.phase = 'idle'; }
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
    if (state.phase === 'picking' && !state.dealing) dealFan(false);
    if (state.phase !== 'shuffling') relayoutPlaced();
    updateHint();
    drawLines(false);
  }, 150);
});

buildStack();
renderSlots();
updateIntro();
