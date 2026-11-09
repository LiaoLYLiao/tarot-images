'use strict';

// 起始頁：星座軌道選情境、每日一牌與隨手一抽的入口

/* ================= 起始頁：星座軌道選情境 ================= */
const home = $('#home');
// 五個情境依序編號 I～V；每日一牌與隨手一抽是特別模式，不編號
const TOPIC_KEYS = ['love', 'career', 'study', 'self', 'general'];
const ROMAN_N = ['I', 'II', 'III', 'IV', 'V'];
const SCENES = {
  daily: { name: '每日一牌', en: 'The Daily Card', sub: '今天的指引，一天只能抽一張', note: '深呼吸，想著今天的自己' },
  quick: { name: '隨手一抽', en: 'Quick Draw', sub: '不用情境、不用牌陣，讓一張牌幫你決定', note: '心裡想著那件決定不了的事' },
  love: { name: '感情', en: 'Love', sub: '靜下心，想著那個人，或那段關係' },
  career: { name: '事業', en: 'Career', sub: '想著你在工作上的處境與抉擇' },
  study: { name: '學業', en: 'Study', sub: '想著你的學習目標，或眼前的考試' },
  self: { name: '自我成長', en: 'Inner Self', sub: '把注意力，慢慢放回自己身上' },
  general: { name: '綜合', en: 'Any Question', sub: '在心中默念，任何你想問的事' },
};
const AURA = { daily: '232,200,119', quick: '90,210,200', general: '120,90,220', love: '255,110,170', career: '240,180,80', study: '80,180,255', self: '160,120,255' };
const isSpecial = (key) => key === 'daily' || key === 'quick';

let auraTimer = 0;
function setAura(key) {
  const rgb = AURA[key] || AURA.general;
  const aura = $('#aura');
  aura.style.opacity = 0;
  clearTimeout(auraTimer);
  auraTimer = setTimeout(() => { aura.style.setProperty('--aura', rgb); aura.style.opacity = 1; }, 250);
  home.style.setProperty('--accent-rgb', rgb);
  $('#wheel').style.setProperty('--accent-rgb', rgb);
}

function showScreen(name) {
  home.classList.toggle('show', name === 'home');
  $('#quick').classList.toggle('show', name === 'quick');
  state.screen = name;
  if (name === 'home') orbit.start(); else orbit.stop();
}

// 情境排在中央牌卡周圍的橢圓軌道上；轉到正前方（角度 90°）的就是選到的情境。
// 今天已經抽過每日一牌時，每日一牌就從軌道上收起來。
const orbit = (() => {
  const root = $('#orbit'), card = root.querySelector('.orbit-card');
  let orbs = [], keys = [], stepA = 1, base = Math.PI / 2, target = base, drag = null, raf = 0, spinTimer = 0;

  // 軌道上只有五個情境；每日一牌與隨手一抽固定在左右上角，不進軌道
  const sides = [...document.querySelectorAll('.orb.side')];
  function refresh() {
    orbs = [...root.querySelectorAll('.orb')];
    keys = orbs.map((o) => o.dataset.scene);
    stepA = (Math.PI * 2) / orbs.length;
    const done = !!todayDaily();
    const daily = sides.find((b) => b.dataset.scene === 'daily');
    daily.classList.toggle('nudge', !done);
    daily.classList.toggle('done', done);
    daily.querySelector('.orb-tag').textContent = done ? '今日已抽' : '今天還沒抽';
  }
  function selectSide(key) {
    orbs.forEach((o) => o.classList.remove('on'));
    sides.forEach((b) => b.classList.toggle('on', b.dataset.scene === key));
    selectScene(key);
  }
  sides.forEach((b) => b.addEventListener('click', () => { refresh(); selectSide(b.dataset.scene); }));

  let lastW = 0;
  function frame() {
    const settled = !drag && Math.abs(target - base) < 0.0005;
    base = settled ? target : base + (target - base) * 0.12;
    const w = root.clientWidth, h = root.clientHeight;
    if (settled && lastW === w) { raf = 0; return; } // 停住了：不再重畫，等下一次選擇或拖曳
    if (settled) lastW = w;
    const cx = w / 2, cy = h / 2, rx = w * 0.42, ry = h * 0.3;
    orbs.forEach((o, i) => {
      const a = base + i * stepA, depth = (Math.sin(a) + 1) / 2;
      o.style.transform = `translate(${cx + Math.cos(a) * rx}px, ${cy + Math.sin(a) * ry}px) translate(-50%, -50%) scale(${(0.66 + depth * 0.44).toFixed(3)})`;
      o.style.opacity = (0.3 + depth * 0.7).toFixed(2);
      o.style.zIndex = depth > 0.55 ? 3 : 1;
    });
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { lastW = 0; if (!raf && state.screen === 'home') raf = requestAnimationFrame(frame); };

  function select(i) {
    const n = orbs.length, sel = ((i % n) + n) % n;
    let t = Math.PI / 2 - sel * stepA; // 走最短的方向轉過去
    while (t - base > Math.PI) t -= Math.PI * 2;
    while (t - base < -Math.PI) t += Math.PI * 2;
    target = t;
    kick();
    sides.forEach((b) => b.classList.remove('on'));
    orbs.forEach((o, k) => o.classList.toggle('on', k === sel));
    // 連續快速切換時，等停下來再轉中央的牌、換背景色
    clearTimeout(spinTimer);
    spinTimer = setTimeout(() => {
      card.classList.remove('spin');
      void card.offsetWidth;
      card.classList.add('spin');
    }, 120);
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
    kick();
  });
  root.addEventListener('pointercancel', () => {
    if (!drag) return;
    drag = null;
    select(Math.round((Math.PI / 2 - base) / stepA));
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
    select(key) { refresh(); if (isSpecial(key)) selectSide(key); else select(Math.max(keys.indexOf(key), 0)); },
    start() { lastW = 0; if (!raf) raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    kick,
  };
})();

$('#spreadBtn').innerHTML = `<svg class="sb-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30"/><circle cx="32" cy="32" r="25" class="thin"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(0 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(15 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(30 32 32)"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(45 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(60 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(75 32 32)"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(90 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(105 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(120 32 32)"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(135 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(150 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(165 32 32)"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(180 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(195 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(210 32 32)"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(225 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(240 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(255 32 32)"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(270 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(285 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(300 32 32)"/><line x1="32" y1="3" x2="32" y2="7.5" transform="rotate(315 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(330 32 32)"/><line x1="32" y1="4.5" x2="32" y2="6.5" transform="rotate(345 32 32)"/><path class="pt" d="M32 0.5l2 4.5h-4zM32 63.5l2-4.5h-4zM0.5 32l4.5-2v4zM63.5 32l-4.5-2v4z"/></svg><svg class="sb-fan" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="4" width="7" height="11" rx="1.2" transform="rotate(-18 12.5 15)"/><rect x="9" y="4" width="7" height="11" rx="1.2" transform="rotate(18 12.5 15)"/><rect x="9" y="3" width="7" height="11" rx="1.2"/><circle cx="12.5" cy="8.5" r="1.3" class="dot"/></svg><span class="sb-label">牌陣</span>`;

// 每個情境目前選的牌陣（預設是最推薦的那個）
const sceneSpread = {};

function selectScene(key) {
  state.sceneKey = key;
  const info = SCENES[key];
  const n = TOPIC_KEYS.indexOf(key);
  home.querySelector('.scene-en').textContent = n >= 0 ? `${ROMAN_N[n]} · ${info.en}` : info.en;
  home.querySelector('.scene-info h2').textContent = info.name;
  home.querySelector('.scene-sub').textContent = info.sub;
  setAura(key);
  const special = isSpecial(key);
  home.classList.toggle('daily', special);
  $('.orbit-wrap').classList.toggle('special', special);
  if (special) home.querySelector('.daily-note').textContent = info.note;
  else {
    setTopic(key);
    store.set('starTarot.scene', key);
  }
  updateStart();
}

function updateStart() {
  const key = state.sceneKey;
  if (key === 'daily') {
    const today = todayDaily();
    $('#startBtn .t').textContent = today ? '回顧今天的牌' : '抽今天的牌';
    $('#startBtn .s').textContent = today ? `今天抽到「${CARD_BY_FILE[today.picks[0].file]?.zh || ''}」` : '每日一牌 · 1 張';
    home.querySelector('.daily-note').textContent = today ? '一天只能抽一張，明天再來吧' : SCENES.daily.note;
    return;
  }
  if (key === 'quick') {
    $('#startBtn .t').textContent = '隨手抽一張';
    $('#startBtn .s').textContent = '從卡夾抽出一張牌';
    return;
  }
  const sp = sceneSpread[key] || TOPIC_SPREADS[key][0];
  sceneSpread[key] = sp;
  $('#startBtn .t').textContent = '開始洗牌';
  $('#startBtn .s').textContent = `${SPREADS[sp].name} · ${SPREADS[sp].positions.length} 張`;

}

// 回到起始頁；今天還沒抽每日一牌就先停在每日一牌，抽過了就回到上次的情境
function showHome(key) {
  if (state.screen === 'quick') quick.reset();
  home.classList.remove('handoff');
  showScreen('home');
  const pick = !todayDaily() && !key ? 'daily' : key && key !== 'daily' ? key : store.get('starTarot.scene', 'love');
  orbit.select(pick);
  wheel.close(true);
}

$('#startBtn').addEventListener('click', () => {
  if (state.phase !== 'idle') return;
  sound.unlock();
  if (state.sceneKey === 'daily') {
    const today = todayDaily();
    if (today) return openSheet(readingFromHistory(today), 'calendar');
    setTopic('general');
    $('#question').value = '';
    startReading('one');
  } else if (state.sceneKey === 'quick') {
    quick.open();
  } else {
    startReading(sceneSpread[state.sceneKey]);
  }
});
