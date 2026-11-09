'use strict';

// 隨手一抽：卡夾、抽牌儀式與結論

/* ================= 隨手一抽 ================= */
// 卡夾打開、一道光從裡面射出；把牌往上拉出來（或輕點卡夾），
// 牌飛到中央旋轉、蓄力、翻開，直接告訴你要不要做
const quick = (() => {
  const root = $('#quick'), box = root.querySelector('.case'), peek = root.querySelector('.peek');
  const result = root.querySelector('.q-result'), layer = $('#qLayer');
  const dim = layer.querySelector('.q-dim'), rays = layer.querySelector('.q-rays');
  let drag = null, busy = false, ready = false, cur = null, el = null, ambient = 0, openTimer = 0, lastReading = null;

  function open() {
    reset();
    setAura('quick');
    showScreen('quick');
    // 卡夾的蓋子打開，光從裡面射出來
    openTimer = setTimeout(() => {
      root.classList.add('opened');
      sound.whoosh();
      setTimeout(() => { ready = true; }, 700);
    }, 800);
    clearInterval(ambient);
    ambient = setInterval(() => {
      if (state.screen !== 'quick' || busy) return;
      const r = box.getBoundingClientRect();
      fx.sparkle(r.left + r.width * (0.1 + rand() * 0.8), r.top - r.height * (0.1 + rand() * 0.5), 1);
    }, 180);
  }

  function reset() {
    busy = false;
    ready = false;
    cur = null;
    clearTimeout(openTimer);
    if (el) { live.detach(el.querySelector('.front')); el.remove(); el = null; }
    root.classList.remove('pulled', 'done', 'opened');
    result.hidden = true;
    peek.style.transform = '';
    dim.classList.remove('on');
    rays.classList.remove('on');
  }

  function leave() {
    clearInterval(ambient);
    reset();
  }

  // 卡片定位：中央大牌，翻開後往上移，下面留給結論
  const bigRect = () => {
    const w = Math.min(VW() * 0.46, 220, (VH() * 0.46) / CARD_RATIO);
    return { x: VW() / 2, y: VH() * 0.44, w, h: w * CARD_RATIO, rot: 0 };
  };
  const smallRect = () => {
    const h = Math.min(VH() * 0.36, 300), w = h / CARD_RATIO;
    return { x: VW() / 2, y: headerBottom() + 14 + h / 2, w, h, rot: 0 };
  };
  const placeRays = (p) => {
    const d = p.h * 1.9;
    Object.assign(rays.style, { width: `${d}px`, height: `${d}px`, left: `${p.x - d / 2}px`, top: `${p.y - d / 2}px` });
  };

  async function pull() {
    if (busy || !ready) return;
    busy = true;
    sound.unlock();
    const card = CARDS[Math.floor(rand() * CARDS.length)];
    const reversed = rand() < 0.35;
    cur = { card, reversed };
    const kind = KIND_FX[kindOf(card)];
    layer.style.setProperty('--qc', kind.color);

    // 1. 牌從卡夾裡抽出來，拖著金色光尾
    const r = peek.getBoundingClientRect();
    el = makeCard();
    el.querySelector('img').src = thumb(card);
    el.classList.toggle('reversed', reversed);
    layer.appendChild(el);
    el.style.transitionDuration = '0s';
    const start = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, rot: 0 };
    place(el, start);
    root.classList.add('pulled');
    sound.whoosh();
    if (navigator.vibrate) navigator.vibrate(10);
    const big = bigRect();
    const kf = (p) => ({ transform: cardTransform(p), width: `${p.w}px`, height: `${p.h}px` });
    const up = { ...big, y: Math.min(r.top - big.h * 0.25, big.y - 40), rot: -8 };
    const fly = el.animate([kf(start), { ...kf({ ...start, y: start.y - r.height * 0.9 }), offset: 0.35 }, { ...kf(up), offset: 0.7 }, kf(big)],
      { duration: 1100, easing: 'cubic-bezier(.45,.05,.25,1)' });
    const t0 = performance.now();
    (function trail() {
      const b = el?.getBoundingClientRect();
      if (!b) return;
      fx.sparkle(b.left + b.width / 2, b.top + b.height * 0.8, 3);
      if (performance.now() - t0 < 1050) requestAnimationFrame(trail);
    })();
    await fly.finished.catch(() => {});
    place(el, big);
    placeRays(big);

    // 2. 牌在中央旋轉兩圈，周圍一圈光點環繞
    dim.classList.add('on');
    const spin = el.querySelector('.tilt').animate([{ transform: 'rotateY(0deg) scale(1)' }, { transform: 'rotateY(360deg) scale(1.06)', offset: 0.5 }, { transform: 'rotateY(720deg) scale(1)' }],
      { duration: 1500, easing: 'cubic-bezier(.35,0,.2,1)' });
    const s0 = performance.now();
    (function orbitSparks() {
      const k = (performance.now() - s0) / 1500;
      for (let i = 0; i < 3; i++) {
        const a = k * Math.PI * 4 + (i * Math.PI * 2) / 3;
        fx.sparkle(big.x + Math.cos(a) * big.w * 0.95, big.y + Math.sin(a) * big.h * 0.6, 1);
      }
      if (k < 1) requestAnimationFrame(orbitSparks);
    })();
    sound.riffle();
    await Promise.all([spin.finished.catch(() => {}), Promise.race([el.querySelector('img').decode().catch(() => {}), sleep(1500)])]);

    // 3. 蓄力：光芒展開、三層魔法陣、牌開始震動
    rays.classList.add('on');
    el.classList.add('charging');
    fx.magic(big.x, big.y, big.h * 0.6, kind.color);
    setTimeout(() => fx.magic(big.x, big.y, big.h * 0.82, kind.color), 220);
    setTimeout(() => fx.magic(big.x, big.y, big.h * 1.05, kind.color), 440);
    sound.charge();
    await sleep(900);

    // 4. 閃光、衝擊波、翻牌
    el.classList.remove('charging');
    el.classList.add('flipping', 'flipped');
    if (navigator.vibrate) navigator.vibrate([12, 40, 30]);
    await sleep(360);
    flash(kind.color);
    fx.burst(big.x, big.y, 140, 10, kind.burst);
    setTimeout(() => fx.burst(big.x, big.y, 60, 5, ['gold', 'star']), 160);
    sound.chime(3);
    await sleep(600);
    el.classList.remove('flipping');
    el.classList.add('shine');
    live.attach(el.querySelector('.front'), card);

    // 5. 牌往上讓位（光芒跟著走），結論一個字一個字浮現
    const sr = smallRect();
    el.style.transitionDuration = '.8s';
    rays.style.transition = 'left .8s cubic-bezier(.2,.8,.2,1), top .8s cubic-bezier(.2,.8,.2,1), width .8s, height .8s, opacity 1s, transform 1s';
    place(el, sr);
    placeRays(sr);
    dim.classList.remove('on');
    showResult();
  }

  function showResult() {
    const { card, reversed } = cur;
    const v = quickVerdict(card, reversed);
    const p = { card, reversed };
    result.className = `q-result v-${v.key}`;
    result.querySelector('.q-en').textContent = v.en;
    result.querySelector('.q-verdict').innerHTML = [...v.zh].map((ch, i) => `<span class="glyph" style="animation-delay:${0.25 + i * 0.16}s">${ch}</span>`).join('');
    result.querySelector('.q-line').textContent = v.line;
    result.querySelector('.q-card').innerHTML = `${card.zh}<span>${orientOf(p)} · ${kwOf(p)}</span>`;
    result.querySelector('.q-advice').textContent = card.advice;
    const sr = smallRect();
    result.style.top = `${sr.y + sr.h / 2 + 18}px`;
    result.hidden = false;
    root.classList.add('done');
    // 存進占卜紀錄
    const t = Date.now();
    lastReading = { id: t.toString(36) + Math.floor(rand() * 1e6).toString(36), t, spread: 'quick', topic: 'general', question: '', picks: [{ card, reversed, slot: 0 }] };
    saveHistory(lastReading);
  }

  // 往上拉卡夾裡的牌：拉超過一段距離就抽出；輕點也可以
  box.addEventListener('pointerdown', (e) => {
    if (busy || !ready) return;
    drag = { y: e.clientY, dy: 0 };
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dy = Math.min(0, e.clientY - drag.y);
    peek.style.transform = `translateY(${drag.dy}px)`;
    if (drag.dy < -70) { drag = null; pull(); }
  });
  box.addEventListener('pointercancel', () => { drag = null; peek.style.transform = ''; });
  box.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.dy > -8) pull();
    else peek.style.transform = '';
  });
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-q]')?.dataset.q;
    if (act === 'again') { reset(); sound.riffle(); setTimeout(() => { root.classList.add('opened'); ready = true; }, 250); }
    else if (act === 'detail' && cur) openModal(cur, true);
    else if (act === 'share' && lastReading) openShare(lastReading);
    else if (act === 'home' || e.target.closest('.q-back')) { leave(); showHome('quick'); }
  });

  return {
    open, reset: leave,
    relayout() {
      if (!el || !root.classList.contains('done')) return;
      const sr = smallRect();
      place(el, sr);
      placeRays(sr);
      result.style.top = `${sr.y + sr.h / 2 + 18}px`;
    },
  };
})();
