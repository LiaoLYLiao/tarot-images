'use strict';

// 牌陣輪盤

/* ================= 牌陣輪盤 ================= */
// 右側的牌陣按鈕展開成一個可以旋轉的輪盤；轉到正上方的就是選中的牌陣
const wheel = (() => {
  const root = $('#wheel'), dial = root.querySelector('.dial'), hub = root.querySelector('.hub');
  let items = [], keys = [], step = 0, rot = 0, target = 0, drag = null, raf = 0, sel = 0;

  function build() {
    const recs = TOPIC_SPREADS[state.sceneKey];
    keys = [...recs];
    step = 360 / keys.length;
    dial.innerHTML = keys.map((k, i) => `<button class="wi ${i === 0 ? 'rec' : ''}" data-i="${i}" style="--a:${i * step}deg">
      ${spreadDiagram(k)}<span>${SPREADS[k].name}</span>${i === 0 ? '<em>推薦</em>' : ''}</button>`).join('');
    items = [...dial.children];
  }

  let lastIdx = -1;
  function frame() {
    rot += (target - rot) * 0.16;
    const n = keys.length, idx = n ? (((Math.round(-rot / step) % n) + n) % n) : -1;
    if (idx !== lastIdx) { if (lastIdx >= 0) sound.tick(); lastIdx = idx; }
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
    lastIdx = -1;
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
  dial.addEventListener('pointercancel', () => {
    if (!drag) return;
    drag = null;
    focus(Math.round(-rot / step));
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

// 轉場：起始頁中央那張牌就地變成整副牌堆，再飛到洗牌的位置
function startReading(spreadKey) {
  state.spread = spreadKey;
  $('#question').blur();
  buildStack();
  const r = home.querySelector('.oc-face').getBoundingClientRect();
  state.els.forEach((el) => {
    el.style.transitionDuration = '0s';
    el.style.transitionDelay = '0ms';
    el.style.opacity = 1;
    place(el, { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, rot: 0 });
  });
  void $('#table').offsetWidth;
  home.classList.add('handoff');
  showScreen('table');
  startShuffle();
}
