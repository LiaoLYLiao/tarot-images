'use strict';

// 牌桌：版面計算、牌位標籤與牌的建立

/* ================= 版面計算 ================= */
const headerBottom = () => $('#top').getBoundingClientRect().bottom;

// 洗牌時，牌堆在畫面中央
function stackPos(i) {
  const top = headerBottom() + 16, bottom = VH() * 0.86;
  const h = Math.max(120, Math.min((bottom - top) * 0.62, 340, VW() * 0.46 * CARD_RATIO));
  return { x: VW() / 2, y: (top + bottom) / 2 - i * 0.08, w: h / CARD_RATIO, h, rot: 0 };
}

// 抽牌用的 3D 牌環在畫面下方；cy 是正前方那張牌的中心
function ringGeom() {
  const cw = clamp(VW() * 0.16, 62, 104), ch = cw * CARD_RATIO;
  const cy = VH() - ch * 0.62 - Math.max(34, VH() * 0.05);
  return { cw, ch, cy, top: cy - ch / 2 - 30 };
}

function spreadArea() {
  const top = headerBottom() + 18;
  // 下方要留給：牌環與提示（抽牌）、提示與「全部翻開」（翻牌）、結果按鈕（解讀）
  const multi = SPREADS[state.spread].positions.length > 1;
  const bottom = state.phase === 'reading' ? VH() - 78
    : state.phase === 'revealing' ? VH() - (multi ? 150 : 104)
    : ringGeom().top - 70;
  const side = VW() < 640 ? 8 : 16;
  return { x: side, y: top, w: VW() - side * 2, h: Math.max(120, bottom - top) };
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
const VISIBLE_STACK = 12;
function buildStack() {
  const table = $('#table');
  table.innerHTML = '';
  state.els = CARDS.map((_, i) => {
    const el = makeCard();
    el.classList.add('stack');
    el.style.transitionDuration = '0s';
    el.style.opacity = 0;
    el.style.pointerEvents = 'none';
    // 疊在一起時只看得到最上面幾張；其餘的牌不畫出來，iPhone 才不會因為 78 張 3D 牌同時洗牌而崩潰。
    // 被抽中時（pickFromRing）才會顯示出來。
    if (i < CARDS.length - VISIBLE_STACK) el.style.display = 'none';
    place(el, stackPos(i));
    table.appendChild(el);
    el.addEventListener('click', onCardClick);
    return el;
  });
}

// 78 張 3D 牌很吃手機的繪圖記憶體，所以只在占卜時才建立，回到起始頁就清掉
function clearStack() {
  $('#table').innerHTML = '';
  state.els = [];
}

function onCardClick(e) {
  const el = e.currentTarget;
  const p = state.picks.find((q) => q.el === el);
  if (!p) return;
  if (state.phase === 'revealing' && !p.revealed) reveal(p);
  else if (el.classList.contains('flipped')) openModal(p);
}
