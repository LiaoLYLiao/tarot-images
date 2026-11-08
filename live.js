'use strict';

// 牌面活起來：在牌的插畫區疊一層透明動畫，依牌的類型有不同效果。
// 大牌：上方灑下光束與漂浮光點；聖杯：氣泡上升；權杖：火星飄升與暖光；
// 寶劍：刀光掃過與風；錢幣：金色閃光與金粉。
const live = (() => {
  // 插畫區（以牌的寬高為單位），避開上方數字、邊框與下方牌名
  const ART = { x0: 0.075, x1: 0.925, y0: 0.085, y1: 0.865 };
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = new Map();
  let enabled = true, raf = 0, lastT = 0;
  const R = Math.random;

  function sprite(rgb) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, `rgba(${rgb},.85)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  function coreSprite(core, glow) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, core);
    grd.addColorStop(0.22, core);
    grd.addColorStop(0.4, `rgba(${glow},.8)`);
    grd.addColorStop(1, `rgba(${glow},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  const SPR = {
    gold: sprite('255,214,120'),
    ember: coreSprite('rgba(255,250,210,1)', '255,110,30'),
    light: coreSprite('rgba(255,255,255,1)', '255,236,170'),
  };

  const kindOf = (card) => (card.major ? 'major' : String(card.suit).toLowerCase());

  // 依時間差決定這一格要不要產生新粒子（rate = 每秒幾個）
  const spawn = (dt, rate) => {
    let n = 0, x = rate * dt;
    while (x > 1) { n++; x--; }
    if (R() < x) n++;
    return n;
  };

  const EFFECTS = {
    cups(it, dt, t, w, h, s) {
      const { ctx } = it;
      for (let i = spawn(dt, 3.2 * (w / 300)); i--;) {
        it.parts.push({ x: w * (ART.x0 + 0.04 + R() * (ART.x1 - ART.x0 - 0.08)), y: h * ART.y1, r: (4 + R() * 7) * s, vy: -(18 + R() * 28) * s, ph: R() * 6 });
      }
      it.parts = it.parts.filter((p) => p.y > h * ART.y0);
      ctx.lineWidth = Math.max(0.8, s);
      for (const p of it.parts) {
        p.y += p.vy * dt;
        p.x += Math.sin(t * 0.003 + p.ph) * 0.25 * s;
        const a = Math.min(1, (p.y - h * ART.y0) / (h * 0.12)) * Math.min(1, (h * ART.y1 - p.y) / (h * 0.05));
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,.35)');
        g.addColorStop(0.75, 'rgba(200,235,255,.12)');
        g.addColorStop(1, 'rgba(255,255,255,.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,70,130,.45)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.86, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    wands(it, dt, t, w, h, s) {
      const { ctx } = it;
      ctx.globalCompositeOperation = 'lighter';
      // 底部暖光，慢慢地明暗呼吸
      const pulse = 0.16 + 0.08 * Math.sin(t * 0.0021);
      const g = ctx.createRadialGradient(w / 2, h * ART.y1, 0, w / 2, h * ART.y1, h * 0.55);
      g.addColorStop(0, `rgba(255,140,50,${pulse})`);
      g.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = spawn(dt, 8 * (w / 300)); i--;) {
        const life = 1.6 + R() * 1.6;
        it.parts.push({ x: w * (ART.x0 + R() * (ART.x1 - ART.x0)), y: h * (0.55 + R() * (ART.y1 - 0.55)), vx: (R() - 0.5) * 12 * s, vy: -(16 + R() * 30) * s, size: (16 + R() * 14) * s, age: 0, life, ph: R() * 6 });
      }
      it.parts = it.parts.filter((p) => p.age < p.life);
      ctx.globalCompositeOperation = 'source-over';
      for (const p of it.parts) {
        p.age += dt;
        p.x += (p.vx + Math.sin(t * 0.004 + p.ph) * 6 * s) * dt;
        p.y += p.vy * dt;
        const k = p.age / p.life;
        const a = Math.min(1, (1 - k) * 1.4) * (0.7 + 0.3 * Math.sin(t * 0.02 + p.ph));
        // 火星：亮亮的頭，後面拖一小段尾巴
        const tail = 0.12;
        const tx = p.x - p.vx * tail, ty = p.y - p.vy * tail;
        const g = ctx.createLinearGradient(p.x, p.y, tx, ty);
        g.addColorStop(0, 'rgba(255,220,120,.95)');
        g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.globalAlpha = a;
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1.4, 2.4 * s);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        const sz = p.size * (1 - k * 0.4) * 1.3;
        ctx.drawImage(SPR.ember, p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    },

    swords(it, dt, t, w, h, s) {
      const { ctx } = it;
      ctx.globalCompositeOperation = 'lighter';
      // 每隔幾秒，一道刀光斜斜掃過
      if (!it.next) it.next = t + 600 + R() * 1200;
      if (t > it.next && !it.sweep) { it.sweep = t; it.next = t + 3200 + R() * 1600; }
      if (it.sweep) {
        const k = (t - it.sweep) / 900;
        if (k >= 1) it.sweep = 0;
        else {
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.rotate(-0.55);
          const x = -w + k * w * 2, band = 70 * s;
          const g = ctx.createLinearGradient(x - band, 0, x + band, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, 'rgba(240,248,255,.75)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = Math.sin(k * Math.PI);
          ctx.fillStyle = g;
          ctx.fillRect(x - band, -h, band * 2, h * 2);
          ctx.restore();
        }
      }
      // 一陣一陣的風
      for (let i = spawn(dt, 1.6 * (w / 300)); i--;) {
        it.parts.push({ x: w * ART.x0 - 40 * s, y: h * (ART.y0 + 0.05 + R() * (ART.y1 - ART.y0 - 0.1)), len: (30 + R() * 40) * s, v: (200 + R() * 120) * s, age: 0 });
      }
      it.parts = it.parts.filter((p) => p.x - p.len < w * ART.x1);
      ctx.lineWidth = Math.max(1.2, 2 * s);
      ctx.lineCap = 'round';
      for (const p of it.parts) {
        p.x += p.v * dt;
        p.age += dt;
        const g = ctx.createLinearGradient(p.x - p.len, 0, p.x, 0);
        g.addColorStop(0, 'rgba(230,240,255,0)');
        g.addColorStop(1, 'rgba(240,248,255,.85)');
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(p.x - p.len, p.y);
        ctx.quadraticCurveTo(p.x - p.len / 2, p.y - 4 * s, p.x, p.y);
        ctx.stroke();
      }
    },

    pentacles(it, dt, t, w, h, s) {
      const { ctx } = it;
      ctx.globalCompositeOperation = 'lighter';
      // 金色十字閃光
      for (let i = spawn(dt, 2.6 * (w / 300)); i--;) {
        it.parts.push({ type: 'twinkle', x: w * (ART.x0 + 0.05 + R() * (ART.x1 - ART.x0 - 0.1)), y: h * (ART.y0 + 0.05 + R() * (ART.y1 - ART.y0 - 0.1)), age: 0, life: 0.9 + R() * 0.6, size: (14 + R() * 12) * s });
      }
      // 緩緩落下的金粉
      for (let i = spawn(dt, 3.5 * (w / 300)); i--;) {
        it.parts.push({ type: 'dust', x: w * (ART.x0 + R() * (ART.x1 - ART.x0)), y: h * (ART.y0 + R() * (ART.y1 - ART.y0) * 0.7), vy: (8 + R() * 14) * s, age: 0, life: 4 + R() * 3, size: (3.5 + R() * 3) * s, ph: R() * 6 });
      }
      it.parts = it.parts.filter((p) => p.age < p.life && p.y < h * ART.y1);
      for (const p of it.parts) {
        p.age += dt;
        const k = p.age / p.life;
        if (p.type === 'dust') {
          p.y += p.vy * dt;
          p.x += Math.sin(t * 0.002 + p.ph) * 0.2 * s;
          ctx.globalAlpha = 0.85 * Math.sin(k * Math.PI);
          ctx.drawImage(SPR.gold, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        } else {
          const sc = Math.sin(k * Math.PI), L = p.size * 1.6 * sc;
          ctx.globalAlpha = sc;
          ctx.strokeStyle = 'rgba(255,240,190,1)';
          ctx.lineWidth = Math.max(1.2, 1.6 * s);
          ctx.beginPath();
          ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y);
          ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L);
          ctx.stroke();
          ctx.drawImage(SPR.gold, p.x - p.size * sc / 2, p.y - p.size * sc / 2, p.size * sc, p.size * sc);
        }
      }
    },

    major(it, dt, t, w, h, s) {
      const { ctx } = it;
      ctx.globalCompositeOperation = 'lighter';
      // 從上方斜斜灑下的光束，緩慢擺動
      const ox = w / 2, oy = h * (ART.y0 - 0.12);
      for (let i = 0; i < 4; i++) {
        const ang = (i - 1.5) * 0.24 + Math.sin(t * 0.00035 + i * 1.7) * 0.07;
        const len = h * 0.95, half = w * 0.13;
        const ex = ox + Math.sin(ang) * len, ey = oy + Math.cos(ang) * len;
        const px = Math.cos(ang) * half, py = -Math.sin(ang) * half;
        const g = ctx.createLinearGradient(ox, oy, ex, ey);
        g.addColorStop(0, 'rgba(255,250,230,.6)');
        g.addColorStop(1, 'rgba(255,248,220,0)');
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 0.0011 + i * 2.1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ex + px, ey + py);
        ctx.lineTo(ex - px, ey - py);
        ctx.closePath();
        ctx.fill();
      }
      // 漂浮的光點
      for (let i = spawn(dt, 3.2 * (w / 300)); i--;) {
        it.parts.push({ x: w * (ART.x0 + R() * (ART.x1 - ART.x0)), y: h * (ART.y0 + 0.1 + R() * (ART.y1 - ART.y0 - 0.1)), vx: (R() - 0.5) * 6 * s, vy: -(4 + R() * 8) * s, age: 0, life: 3.5 + R() * 2.5, size: (9 + R() * 9) * s, ph: R() * 6 });
      }
      it.parts = it.parts.filter((p) => p.age < p.life);
      ctx.globalCompositeOperation = 'source-over';
      for (const p of it.parts) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.sin((p.age / p.life) * Math.PI) * (0.7 + 0.3 * Math.sin(t * 0.006 + p.ph));
        ctx.drawImage(SPR.light, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    },
  };

  function frame(t) {
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    for (const it of items.values()) {
      if (!it.visible) continue;
      const w = it.host.clientWidth, h = it.host.clientHeight;
      if (!w || !h) continue;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (it.canvas.width !== Math.round(w * dpr) || it.canvas.height !== Math.round(h * dpr)) {
        it.canvas.width = Math.round(w * dpr);
        it.canvas.height = Math.round(h * dpr);
      }
      const { ctx } = it;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!enabled) continue;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(w * ART.x0, h * ART.y0, w * (ART.x1 - ART.x0), h * (ART.y1 - ART.y0), w * 0.04);
      ctx.clip();
      EFFECTS[it.kind](it, dt, t, w, h, Math.max(w / 300, 0.9));
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    raf = items.size ? requestAnimationFrame(frame) : 0;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { const it = items.get(e.target); if (it) it.visible = e.isIntersecting; }
  });

  return {
    // host 要是 position: relative（或 absolute）的牌面容器
    attach(host, card) {
      if (calm || items.has(host) || !EFFECTS[kindOf(card)]) return;
      const canvas = document.createElement('canvas');
      canvas.className = 'live-layer';
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit';
      host.appendChild(canvas);
      items.set(host, { host, canvas, ctx: canvas.getContext('2d'), kind: kindOf(card), parts: [], visible: true });
      io.observe(host);
      if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
    },
    detach(host) {
      const it = items.get(host);
      if (!it) return;
      it.canvas.remove();
      io.unobserve(host);
      items.delete(host);
    },
    setEnabled(on) { enabled = on; },
  };
})();
