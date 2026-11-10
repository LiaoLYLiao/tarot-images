'use strict';

// 占卜流程：洗牌、3D 牌環、抽牌、翻牌與回到起始頁

/* ================= 洗牌 ================= */
async function startShuffle() {
  if (state.phase === 'shuffling') return;
  sound.unlock();
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
      place(el, { ...stackPos(i), x: s.x + side * Math.min(s.w * (0.55 + rand() * 0.15), VW() / 2 - s.w / 2 - 6), y: s.y - i * 0.25 + (rand() - 0.5) * 10, rot: side * (6 + rand() * 6) });
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
  // 牌環的牌排得很密，正前方那張和左右兩張的深度只差一點點，Safari 有時會疊錯順序。
  // 所以停下來時，在正前方另外放一張完整的牌背，蓋在牌環上面。
  const focus = document.createElement('div');
  focus.className = 'ring-focus';
  focus.innerHTML = '<div class="face back"></div>';
  root.appendChild(focus);
  let cards = [], step = 0, R = 0, rot = 0, vel = 0, drag = null, raf = 0, intro = null, frontIdx = -1, moving = false;

  function layout() {
    const g = ringGeom();
    const n = Math.max(cards.length, 1);
    step = 360 / n;
    R = Math.max((n * g.cw * 0.52) / (2 * Math.PI), g.cw * 2.3);
    root.style.top = `${g.top - 40}px`;
    root.style.perspectiveOrigin = `50% ${g.cy - (g.top - 40)}px`;
    spin.style.top = `${g.cy - (g.top - 40)}px`;
    spin.style.setProperty('--R', `${R}px`);
    Object.assign(focus.style, { top: `${g.cy - (g.top - 40)}px`, width: `${g.cw * 1.14}px`, height: `${g.ch * 1.14}px`, marginLeft: `${-g.cw * 0.57}px`, marginTop: `${-g.ch * 0.57}px` });
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
      if (frontIdx >= 0 && !intro) sound.tick();
      cards[frontIdx]?.el.classList.remove('facing');
      cards[idx]?.el.classList.add('facing');
      frontIdx = idx;
    }
    // 轉動中先看整個牌環；停下來後，正前方的牌才浮出來
    const m = !!(intro || drag || Math.abs(vel) > 0.25 || Math.abs(rot - Math.round(rot / step) * step) > step * 0.3);
    if (m !== moving) { moving = m; root.classList.toggle('moving', m); }
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
  root.addEventListener('pointercancel', () => { drag = null; });
  root.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d || d.moved > 6) return;
    root.releasePointerCapture(e.pointerId);
    const f = focus.getBoundingClientRect();
    if (!moving && cards[frontIdx] && e.clientX >= f.left && e.clientX <= f.right && e.clientY >= f.top && e.clientY <= f.bottom) {
      pickFromRing(cards[frontIdx].k);
      return;
    }
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
      moving = true;
      root.classList.add('moving');
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
    rectOf(k) {
      if (!moving && cards[frontIdx]?.k === k) return focus.getBoundingClientRect();
      return cards.find((c) => c.k === k)?.el.getBoundingClientRect();
    },
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
    place(el, { x: VW() / 2, y: g.cy, w: g.cw, h: g.ch, rot: 0 });
  });
  sound.whoosh();
  await sleep(350);
  state.els.forEach((el) => { if (!el.classList.contains('flying') && !el.classList.contains('placed')) el.style.display = 'none'; });
  const ms = ring.show(ks);
  for (let i = 0; i < 14; i++) setTimeout(() => fx.sparkle(VW() * (0.15 + Math.random() * 0.7), g.cy + (Math.random() - 0.5) * g.ch, 2), i * 60);
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
  el.style.display = '';
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
  tag.style.left = `${clamp(r.left + r.width / 2 - w / 2, 8, VW() - w - 8)}px`;
  tag.style.top = `${Math.min(r.bottom - 10, VH() - 60)}px`;
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
  closeModal();
  sheet.hidden = true;
  state.picks.forEach((p) => live.detach(p.el.querySelector('.front')));
  // 轉場：桌上的牌翻回背面、收攏成一疊，飛回起始頁中央那張牌的位置
  const target = home.querySelector('.oc-face').getBoundingClientRect();
  const picked = [...state.picks].sort((a, b) => a.slot - b.slot);
  state.els.forEach((el) => {
    el.style.pointerEvents = 'none';
    if (!el.classList.contains('placed')) { el.style.transitionDuration = '.3s'; el.style.opacity = 0; }
  });
  picked.forEach((p, i) => {
    const el = p.el;
    el.classList.remove('flipped', 'shine', 'active');
    el.style.transitionDuration = '.75s';
    el.style.transitionDelay = `${i * 40}ms`;
    place(el, { x: target.left + target.width / 2, y: target.top + target.height / 2, w: target.width, h: target.height, rot: (i - (picked.length - 1) / 2) * 4 });
  });
  state.phase = 'idle';
  state.picks = [];
  state.revealed = 0;
  state.fanN = 0;
  state.dealing = false;
  renderSlots();
  updateHint();
  updateHeader();
  if (picked.length) {
    sound.whoosh();
    await sleep(750 + picked.length * 40);
  }
  // 收回來的牌移到另一層慢慢淡出，同時把新的一副牌準備好
  const ghosts = $('#ghosts');
  picked.forEach((p) => ghosts.appendChild(p.el));
  clearStack();
  showHome(toLanding ? null : state.spread === 'one' ? 'daily' : state.topic);
  void ghosts.offsetWidth;
  picked.forEach((p) => { p.el.style.transitionDuration = '.5s'; p.el.style.transitionDelay = '0ms'; p.el.style.opacity = 0; });
  setTimeout(() => picked.forEach((p) => p.el.remove()), 600);
}
