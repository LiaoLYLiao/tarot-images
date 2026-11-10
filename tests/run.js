// 星空塔羅的自動測試：在模擬的手機與電腦瀏覽器裡跑完整流程。
// 用法：node tests/run.js            （全部）
//       node tests/run.js flow quick （只跑指定的項目）
// 需要 Node.js 與 Playwright：npm i -D playwright && npx playwright install chromium
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 700 } };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

// ---------- 小型靜態網頁伺服器 ----------
function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  return new Promise((ok) => server.listen(0, () => ok({ server, url: `http://localhost:${server.address().port}/` })));
}

// ---------- 小工具 ----------
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
async function open(browser, opts, url) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}
const waitPicking = (page) => page.waitForFunction(() => state.phase === 'picking' && !state.dealing, null, { timeout: 20000 });
const frontOfRing = (page) => page.evaluate(() => ({ x: VW() / 2, y: ringGeom().cy - 10 }));

// 從起始頁選情境與牌陣，抽完、翻完，回傳抽到的牌
async function drawSpread(page, scene, spread) {
  await page.click(`.orb[data-scene=${scene}]`);
  await page.waitForTimeout(700);
  if (spread) {
    await page.click('#spreadBtn');
    await page.waitForTimeout(600);
    const name = await page.evaluate((k) => SPREADS[k].name, spread);
    await page.locator('.wi', { hasText: name }).click();
    await page.waitForTimeout(400);
    if (await page.$eval('#wheel', (e) => e.classList.contains('open'))) await page.click('.hub-ok');
    await page.waitForTimeout(500);
  }
  await page.click('#startBtn');
  const n = await page.evaluate(() => SPREADS[state.spread].positions.length);
  for (let i = 0; i < n; i++) {
    await waitPicking(page);
    await page.waitForTimeout(300);
    const f = await frontOfRing(page);
    await page.mouse.click(f.x, f.y);
    await page.waitForTimeout(450);
  }
  await page.waitForFunction(() => state.phase === 'revealing', null, { timeout: 20000 });
  if (n > 1) await page.click('#revealAllBtn');
  else {
    const b = await (await page.$('.card.placed')).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  await page.waitForFunction(() => state.phase === 'reading', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  return page.evaluate(() => state.picks.map((p) => p.card));
}

// ---------- 測試項目 ----------
const SUITES = {
  // 每個情境的推薦牌陣都能從頭抽到完整解讀，再回到起始頁
  async flow(browser, url) {
    for (const [label, opts] of [['手機', PHONE], ['電腦', DESKTOP]]) {
      const { ctx, page, errors } = await open(browser, opts, url);
      for (const [scene, spread] of [['love', 'love'], ['career', 'people'], ['study', 'exam'], ['self', 'heal'], ['general', 'theme'], ['general', 'celtic'], ['study', 'choice']]) {
        const cards = await drawSpread(page, scene, spread);
        const expected = await page.evaluate((k) => SPREADS[k].positions.length, spread);
        assert(cards.length === expected, `${label} ${spread}：抽到 ${cards.length} 張，應為 ${expected} 張`);
        if (spread === 'theme') assert(cards[0].major && cards.slice(1).every((c) => !c.major), `${label} 一大三小的牌池不對`);
        assert(await page.$$eval('.placed .front canvas.live-layer', (e) => e.length) === expected, `${label} ${spread}：翻開的牌沒有動態`);
        await page.click('#readingBtn');
        await page.waitForTimeout(400);
        assert(await page.$('.summary'), `${label} ${spread}：完整解讀沒有總結`);
        await page.click('.sheet-tools [data-act=ai]');
        await page.waitForTimeout(200);
        const prompt = await page.$eval('#askText', (e) => e.value);
        assert(cards.every((c) => prompt.includes(c.zh)), `${label} ${spread}：AI 提問沒有列出所有抽到的牌`);
        await page.click('#ask .close');
        await page.keyboard.press('Escape');
        await page.click('#againBtn');
        await page.waitForFunction(() => state.screen === 'home' && state.phase === 'idle', null, { timeout: 5000 });
        await page.waitForTimeout(500);
      }
      assert(errors.length === 0, `${label} 頁面錯誤：${errors.join(' / ')}`);
      await ctx.close();
    }
  },

  // 每日一牌：抽完後按鈕變成「今日已抽」，點了是回顧
  async daily(browser, url) {
    const { ctx, page, errors } = await open(browser, PHONE, url);
    assert(await page.evaluate(() => state.sceneKey) === 'daily', '今天沒抽時，打開應該先停在每日一牌');
    await page.click('#startBtn');
    await waitPicking(page);
    const f = await frontOfRing(page);
    await page.mouse.click(f.x, f.y);
    await page.waitForFunction(() => state.phase === 'revealing', null, { timeout: 15000 });
    const b = await (await page.$('.card.placed')).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForFunction(() => state.phase === 'reading', null, { timeout: 15000 });
    await page.click('#againBtn');
    await page.waitForTimeout(1500);
    assert(await page.$eval('.orb.side-l .orb-tag', (e) => e.textContent) === '今日已抽', '抽完後每日一牌應顯示「今日已抽」');
    await page.click('.orb.side-l');
    await page.waitForTimeout(400);
    await page.click('#startBtn');
    await page.waitForTimeout(500);
    assert(await page.$eval('#sheet', (e) => !e.hidden), '今天抽過後，應該是回顧今天的牌');
    assert(errors.length === 0, `頁面錯誤：${errors.join(' / ')}`);
    await ctx.close();
  },

  // 隨手一抽：拉出卡夾裡的牌，出現結論，並存進紀錄
  async quick(browser, url) {
    const { ctx, page, errors } = await open(browser, PHONE, url);
    await page.click('.orb.side-r');
    await page.waitForTimeout(600);
    await page.click('#startBtn');
    await page.waitForTimeout(1800);
    const cb = await (await page.$('.case')).boundingBox();
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(cb.x + cb.width / 2, cb.y - 90, { steps: 12 });
    await page.mouse.up();
    await page.waitForSelector('.q-result:not([hidden])', { timeout: 15000 });
    const verdict = await page.$eval('.q-verdict', (e) => e.textContent);
    assert(['去做吧', '可以試試', '再想想', '時機未到', '先不要'].includes(verdict), `結論不對：${verdict}`);
    await page.click('[data-q=ai]');
    await page.waitForTimeout(300);
    const prompt = await page.$eval('#askText', (e) => e.value);
    const drawn = await page.$eval('.q-card', (e) => e.firstChild.textContent);
    assert(prompt.includes(drawn) && /正位|逆位/.test(prompt), '隨手一抽的 AI 提問沒有包含抽到的牌');
    await page.click('#ask .close');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('starTarot.history') || '[]').filter((h) => h.spread === 'quick').length);
    assert(saved === 1, '隨手一抽沒有存進紀錄');
    await page.click('[data-q=home]');
    await page.waitForTimeout(800);
    assert(await page.$$eval('#qLayer .card', (e) => e.length) === 0, '回到起始頁後，隨手一抽的牌沒有清掉');
    assert(errors.length === 0, `頁面錯誤：${errors.join(' / ')}`);
    await ctx.close();
  },

  // 每個情境只列出自己的牌陣；情境編號從 I 開始
  async scenes(browser, url) {
    const { ctx, page } = await open(browser, PHONE, url);
    const expect = { love: '關係牌陣/對方的心/一大三小', career: '職涯牌陣/職場人際/凱爾特十字', study: '學業牌陣/考試運勢/二選一', self: '身心靈牌陣/情緒療癒/一大三小', general: '一大三小/凱爾特十字/二選一' };
    const roman = { love: 'I', career: 'II', study: 'III', self: 'IV', general: 'V' };
    for (const [k, list] of Object.entries(expect)) {
      await page.click(`.orb[data-scene=${k}]`);
      await page.waitForTimeout(600);
      assert((await page.$eval('#home .scene-en', (e) => e.textContent)).startsWith(roman[k] + ' ·'), `${k} 的編號應為 ${roman[k]}`);
      await page.click('#spreadBtn');
      await page.waitForTimeout(500);
      const got = await page.$$eval('.wi span', (e) => e.map((x) => x.textContent).join('/'));
      assert(got === list, `${k} 的牌陣應為 ${list}，實際是 ${got}`);
      await page.click('.wheel-close');
      await page.waitForTimeout(500);
    }
    await ctx.close();
  },

  // 起始頁不能捲動；快速操作後記憶體與繪圖量不會一直增加
  async stress(browser, url) {
    const { ctx, page, errors } = await open(browser, PHONE, url);
    const cdp = await ctx.newCDPSession(page);
    let layers = [];
    cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) layers = e.layers; });
    await cdp.send('LayerTree.enable');
    await cdp.send('Performance.enable');
    const measure = async () => {
      await page.waitForTimeout(500);
      const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      const px = layers.filter((l) => l.drawsContent).reduce((s, l) => s + l.width * l.height, 0);
      return { heap: m.JSHeapUsedSize / 1e6, px: px / 1e6 };
    };
    const start = await measure();
    assert(await page.$eval('#home', (e) => e.scrollHeight - e.clientHeight) <= 0, '起始頁不應該可以捲動');
    const ob = await (await page.$('#orbit')).boundingBox();
    for (let i = 0; i < 40; i++) {
      const d = i % 2 ? 1 : -1, pts = [];
      for (let k = 0; k <= 6; k++) pts.push({ x: ob.x + ob.width * (0.5 - d * 0.4 + d * 0.8 * k / 6), y: ob.y + ob.height / 2 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
      for (const pt of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    for (let i = 0; i < 20; i++) {
      await page.click('#orbit .orb[data-scene=love]', { force: true });
      await page.click('#spreadBtn');
      await page.waitForTimeout(120);
      await page.click('.wheel-close');
      await page.waitForTimeout(120);
    }
    const end = await measure();
    assert(end.px < 4, `起始頁繪圖量太大：${end.px.toFixed(1)} 百萬像素（iPhone 可能會當掉）`);
    assert(end.heap - start.heap < 10, `記憶體增加太多：${(end.heap - start.heap).toFixed(1)} MB`);
    assert(errors.length === 0, `頁面錯誤：${errors.join(' / ')}`);
    await ctx.close();
  },

  // 洗牌與抽牌過程中，繪圖量不能大到讓 iPhone 崩潰（曾經在洗牌時達到約 16 百萬像素）
  async drawMemory(browser, url) {
    const { ctx, page, errors } = await open(browser, PHONE, url);
    const cdp = await ctx.newCDPSession(page);
    let layers = [];
    cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) layers = e.layers; });
    await cdp.send('LayerTree.enable');
    let peak = 0;
    const timer = setInterval(() => {
      const px = layers.filter((l) => l.drawsContent).reduce((s, l) => s + l.width * l.height, 0) / 1e6;
      peak = Math.max(peak, px);
    }, 100);
    await drawSpread(page, 'general', 'celtic');
    clearInterval(timer);
    assert(peak < 5, `抽牌過程中繪圖量最高 ${peak.toFixed(1)} 百萬像素，iPhone 可能會崩潰`);
    assert(errors.length === 0, `頁面錯誤：${errors.join(' / ')}`);
    await ctx.close();
  },

  // 正逆位各一半：直接用網站的洗牌程式洗 400 次統計
  async randomness(browser, url) {
    const { ctx, page } = await open(browser, PHONE, url);
    const r = await page.evaluate(() => {
      let rev = 0, n = 0; const first = {};
      for (let i = 0; i < 400; i++) {
        const deck = shuffled(CARDS).map((card) => ({ card, reversed: rand() < 0.5 }));
        deck.forEach((d) => { n++; if (d.reversed) rev++; });
        first[deck[0].card.file] = (first[deck[0].card.file] || 0) + 1;
      }
      return { ratio: rev / n, distinctFirst: Object.keys(first).length };
    });
    assert(r.ratio > 0.47 && r.ratio < 0.53, `逆位比例 ${(r.ratio * 100).toFixed(1)}%，應接近 50%`);
    assert(r.distinctFirst > 60, `洗牌後第一張牌只出現過 ${r.distinctFirst} 種，洗牌不夠隨機`);
    const src = await page.evaluate(() => [String(startShuffle).includes('rand() < 0.5'), true]);
    assert(src[0], '洗牌的逆位機率不是 50%');
    await ctx.close();
  },

  // 畫面被放大（iPhone 點兩下放大）時，牌的位置不能跑掉
  async zoom(browser, url) {
    const { ctx, page } = await open(browser, PHONE, url);
    await drawSpread(page, 'general', 'theme');
    const before = await page.evaluate(() => state.picks.map((x) => Math.round(x.el.getBoundingClientRect().left)).join(','));
    await page.evaluate(() => {
      Object.defineProperty(window, 'innerWidth', { get: () => 250, configurable: true });
      Object.defineProperty(window, 'innerHeight', { get: () => 450, configurable: true });
      dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(1300);
    const after = await page.evaluate(() => state.picks.map((x) => Math.round(x.el.getBoundingClientRect().left)).join(','));
    assert(before === after, `畫面放大後牌的位置跑掉了：${before} → ${after}`);
    await ctx.close();
  },
};

// ---------- 執行 ----------
(async () => {
  const pick = process.argv.slice(2);
  const names = pick.length ? pick : Object.keys(SUITES);
  const { server, url } = await serve();
  const browser = await chromium.launch();
  let failed = 0;
  for (const name of names) {
    const t0 = Date.now();
    try {
      await SUITES[name](browser, url);
      console.log(`✓ ${name}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } catch (e) {
      failed++;
      console.log(`✗ ${name}  ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
  process.exit(failed ? 1 : 0);
})();
