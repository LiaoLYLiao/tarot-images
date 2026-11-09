'use strict';

// 結果畫面：全息效果、星座連線、本機儲存、單張牌詳情、完整解讀與占卜紀錄

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
    <filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${VW()}" height="${VH()}">
      <feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="lineGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${VW()}" y2="${VH()}">
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
  tooltip.style.left = `${clamp(x - r.width / 2, 12, VW() - r.width - 12)}px`;
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
  const box = (field) => `<div class="${focus === field ? 'focus' : ''}"><h4>${focus === field ? TOPICS[reading.topic].zh : TITLES[field]}</h4><p>${standalone ? card[field] : aspectOf(p, field)}</p></div>`;
  const aspects = `
    <div class="aspects n${fields.length}">${fields.map(box).join('')}</div>
    ${!standalone && reversed ? '<p class="other">以上是這張牌逆位時的意思。</p>' : ''}`;
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
  const sum = summaryReading(picks, reading.spread, sp, reading.topic);
  const posName = (p) => sp.positions[p.slot].name;
  const aspect = (field, title) => `
    <details ${(topic.field || 'love') === field ? 'open' : ''}><summary>${title}</summary>
      ${picks.map((p) => `<p><b>${posName(p)}・${p.card.zh}</b>：${aspectOf(p, field)}</p>`).join('')}
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

    <section class="summary">
      <p class="sum-k">Summary · 總結</p>
      <div class="sum-cards">${picks.map((p) => `<img class="${p === sum.core ? 'core' : ''} ${p.reversed ? 'rev' : ''}" src="${thumb(p.card)}" alt="${p.card.zh}">`).join('')}</div>
      <p class="sum-text">${sum.text}</p>
      <p class="sum-advice"><span>給你的一句話</span>${sum.advice}</p>
    </section>

    <h3>牌陣的故事</h3>
    ${story.map((t) => `<p class="story">${t}</p>`).join('')}

    ${focus ? `
    <h3>${topic.zh}上的解讀</h3>
    <p class="story">${focus.intro}</p>
    ${focus.items.map((it) => `<p class="note-line"><b>${it.label}</b>：${it.text}</p>`).join('')}` : ''}

    <h3>整體能量</h3>
    <div class="elements">${Object.entries(counts).map(([k, v]) => `<span style="color:${ELEMENTS[k].color}">${ELEMENTS[k].zh} × ${v}</span>`).join('')}</div>
    ${notes.map((n) => `<p class="note-line">✦ ${n}</p>`).join('')}

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
