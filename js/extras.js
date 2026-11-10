'use strict';

// 每日一牌日曆、存成圖片與牌卡畫廊

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
  if (act === 'ai') return openAsk(sheetReading);
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
  const sum = summaryReading(picks, reading.spread, sp, reading.topic);
  const SERIF = '"Noto Serif TC", serif', DISPLAY = '"Cinzel", serif', LATIN = '"Cormorant Garamond", serif';

  // 先載入畫面上會用到的字（Google Fonts 只會下載用到的字）
  const allText = [sp.name, topic.zh, reading.question, ...story, focus?.intro || '', sum.text, sum.advice, '總結給你的一句話',
    ...picks.flatMap((p) => [p.card.zh, kwOf(p), sp.positions[p.slot].name]), '正位逆位星空塔羅牌陣的故事上的解讀「」…·'].join('');
  try {
    await Promise.all([document.fonts.load(`40px ${SERIF}`, allText), document.fonts.load(`600 40px ${SERIF}`, allText), document.fonts.load(`500 40px ${DISPLAY}`, 'STAR TAROT'), document.fonts.load(`italic 40px ${LATIN}`, 'Yes Not yet Think again No'), document.fonts.load(`300 76px ${SERIF}`, '去做吧時機未到再想想先不要')]);
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
  ctx.fillText(reading.spread === 'quick' ? `星空塔羅 · ${sp.name}` : `星空塔羅 · ${sp.name} · ${topic.zh}`, W / 2, 180);
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
  // 隨手一抽：先用大字寫出答案
  if (reading.spread === 'quick') {
    const v = quickVerdict(picks[0].card, picks[0].reversed);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c877';
    ctx.font = `italic 40px ${LATIN}`;
    ctx.fillText(v.en, W / 2, y + 10); y += 90;
    ctx.fillStyle = '#f7ecd2';
    ctx.font = `300 76px ${SERIF}`;
    ctx.letterSpacing = '24px';
    ctx.fillText(v.zh, W / 2 + 12, y); y += 80;
    ctx.letterSpacing = '0px';
  }
  // 先放總結和一句話，剩下的空間再放牌陣的故事
  para('總結', sum.text);
  if (y < bottom - 110) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c877';
    ctx.font = `24px ${SERIF}`;
    ctx.letterSpacing = '8px';
    ctx.fillText('給你的一句話', W / 2, y); y += 54;
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffe7a8';
    ctx.font = `34px ${SERIF}`;
    wrapText(ctx, sum.advice, textW).slice(0, 2).forEach((l) => { ctx.fillText(l, W / 2, y); y += 52; });
    y += 40;
  }
  if (reading.spread !== 'quick') para('牌陣的故事', story.slice(reading.spread === 'theme' ? 1 : 0).join(''));

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
    const gw = clamp(Math.min(VW() * 0.085, (VH() - 190) / 3.9 / CARD_RATIO), 54, 112);
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
  root.addEventListener('pointercancel', () => { drag = null; });
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

/* ================= 問 AI ================= */
const ask = $('#ask');
function openAsk(reading) {
  if (!reading) return;
  $('#askText').value = aiPrompt(reading);
  $('#askDone').textContent = '';
  ask.hidden = false;
}
$('#askCopy').addEventListener('click', async () => {
  const t = $('#askText');
  try {
    await navigator.clipboard.writeText(t.value);
    $('#askDone').textContent = '已複製，貼到 AI 聊天視窗就可以了';
  } catch {
    t.focus();
    t.select();
    $('#askDone').textContent = '請長按文字，選「全選」再「拷貝」';
  }
});
ask.addEventListener('click', (e) => { if (e.target === ask || e.target.closest('.close')) ask.hidden = true; });
