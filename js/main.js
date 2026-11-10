'use strict';

// 按鈕事件、搖一搖、視窗大小改變，以及開啟網站時的初始化

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
  if (e.key === 'Escape') { ask.hidden = true; wheel.close(); closeModal(); sheet.hidden = true; share.hidden = true; closeTooltip(); }
});

// 搖一搖洗牌（iPhone 需要權限才會有動作感應，我們不主動跳出詢問，所以 iPhone 上不會觸發）
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
    orbit.kick();
    gallery.resize();
    if (state.phase === 'idle') state.els.forEach((el, i) => place(el, stackPos(i)));
    if (state.phase === 'picking' || state.phase === 'dealing') ring.layout();
    if (state.screen === 'quick') quick.relayout();
    if (state.phase !== 'shuffling') relayoutPlaced();
    updateHint();
    drawLines(false);
  }, 150);
});

renderSlots();
showHome();
