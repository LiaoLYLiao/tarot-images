// 把抽到的牌組合成解讀文字。p = { card, reversed, slot }
const POS_LENS = {
  主題: (kw) => `這次問題真正的核心課題是「${kw}」，其他三張牌都在描述這個課題如何在你的生活中展開`,
  過去: (kw) => `過去的「${kw}」形塑了你今天的處境，這股能量至今仍在影響你`,
  現在: (kw) => `你此刻正處在「${kw}」的狀態中，這是你最需要正視的現實`,
  未來: (kw) => `照目前的方向走下去，事情可能朝「${kw}」發展；未來並非注定，你的選擇仍能改變它`,
  今日指引: (kw) => `今天的關鍵字是「${kw}」，留意生活中與它呼應的小事`,
  現況: (kw) => `問題的核心落在「${kw}」`,
  阻礙: (kw) => `橫在面前的挑戰是「${kw}」，這是你需要跨越的課題`,
  根基: (kw) => `整件事的深層根源與「${kw}」有關，可能是你還沒意識到的部分`,
  目標: (kw) => `你有意識在追求的是「${kw}」`,
  近未來: (kw) => `接下來不久，你將會遇到「${kw}」`,
  自我: (kw) => `你面對這件事的態度是「${kw}」`,
  環境: (kw) => `周遭的人事物為你帶來「${kw}」的影響`,
  希望與恐懼: (kw) => `你心中既期待又害怕的是「${kw}」`,
  結果: (kw) => `綜合所有能量，最可能的走向是「${kw}」`,
};

const kwOf = (p) => (p.reversed ? p.card.rev : p.card.up);
const textOf = (p) => (p.reversed ? p.card.revText : p.card.upText);
const orientOf = (p) => (p.reversed ? '逆位' : '正位');
const firstKw = (p) => kwOf(p).split('、')[0];

function rankLabel(card) {
  return card.rank < 10 ? `數字${RANKS[card.rank][1]}` : `宮廷牌「${RANKS[card.rank][1]}」`;
}

// 牌在這個牌位上的意義，加上數字與花色的能量
function positionText(p, spread) {
  const pos = spread.positions[p.slot];
  const c = p.card, kw = kwOf(p);
  const lens = POS_LENS[pos.name];
  let t = `「${pos.name}」代表${pos.desc}。${c.zh}以${orientOf(p)}出現在這裡，${lens ? lens(kw) : `表示這個面向與「${kw}」有關`}。`;
  if (c.major) {
    t += '這是一張大阿爾克那，代表影響深遠、超出日常層面的力量。';
  } else {
    const [rm, rd] = RANK_MEANING[c.rank];
    const sd = SUIT_DOMAIN[c.suit];
    t += `${rankLabel(c)}象徵「${rm}」（${rd}），${sd.zh}掌管${sd.area}，合起來就是${sd.area}方面的${rm}。`;
  }
  return t;
}

// 整體能量分析
function overviewNotes(picks, spreadKey) {
  const notes = [];
  const n = picks.length;
  if (n < 2) return notes;

  const counts = {};
  picks.forEach((p) => (counts[p.card.element] = (counts[p.card.element] || 0) + 1));
  const [topEl, topN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topN > 1) notes.push(`主導元素是「${ELEMENTS[topEl].zh}」（${topN} 張），這次的關鍵在於${ELEMENTS[topEl].desc}。`);

  const minors = picks.filter((p) => !p.card.major);
  if (minors.length >= 2) {
    const suits = {};
    minors.forEach((p) => (suits[p.card.suit] = (suits[p.card.suit] || 0) + 1));
    const [topSuit, topSuitN] = Object.entries(suits).sort((a, b) => b[1] - a[1])[0];
    if (topSuitN > 1) notes.push(`小牌以${SUIT_DOMAIN[topSuit].zh}為主，這件事主要落在${SUIT_DOMAIN[topSuit].area}的層面。`);
    if (minors.length >= 3) {
      Object.keys(SUIT_DOMAIN).filter((s) => !suits[s]).forEach((s) => notes.push(SUIT_DOMAIN[s].lack));
    }
  }

  if (spreadKey !== 'theme') {
    const majors = n - minors.length;
    if (majors / n >= 0.5) notes.push(`大阿爾克那佔了 ${majors} 張，這件事牽動著深層的人生課題，不只是一時的狀況。`);
    else if (majors === 0) notes.push('全是小阿爾克那，這是日常層面的事，主導權在你自己手上。');
  }

  const revs = picks.filter((p) => p.reversed).length;
  if (revs === 0) notes.push('全部都是正位，能量流動順暢，事情的發展相對直接。');
  else if (revs / n > 0.5) notes.push(`逆位有 ${revs} 張，偏多。有些能量卡住或向內收，先照顧好自己的內在，再處理外在的事。`);
  else notes.push(`有 ${revs} 張逆位，這些位置的能量受到阻礙，需要特別留意。`);

  const pips = minors.filter((p) => p.card.rank < 10);
  if (pips.length >= 2) {
    if (pips.every((p) => p.card.rank <= 2)) notes.push('數字牌都偏小，事情還在早期階段，有很大的發展空間。');
    else if (pips.every((p) => p.card.rank >= 6)) notes.push('數字牌都偏大，事情已進入後期，接近收尾或轉換的時刻。');
  }
  const ranks = {};
  minors.forEach((p) => (ranks[p.card.rank] = (ranks[p.card.rank] || 0) + 1));
  Object.entries(ranks).filter(([, v]) => v >= 2).forEach(([r, v]) => {
    notes.push(`出現 ${v} 張「${RANKS[r][1]}」，「${RANK_MEANING[r][0]}」的主題被特別強調。`);
  });
  const courts = minors.filter((p) => p.card.rank >= 10).length;
  if (courts) notes.push(`出現 ${courts} 張宮廷牌，可能代表參與其中的某個人，或是你需要扮演的角色。`);
  return notes;
}

// 把牌串成一段故事
function storyParagraphs(picks, spreadKey, spread) {
  const at = (name) => picks.find((p) => spread.positions[p.slot].name === name);
  const out = [];
  if (spreadKey === 'theme') {
    const T = at('主題'), past = at('過去'), now = at('現在'), fut = at('未來');
    out.push(`這次的核心課題是「${T.card.zh}」（${orientOf(T)}）。${textOf(T)}`);
    out.push(`從過去的「${past.card.zh}」（${kwOf(past)}）出發，走到現在的「${now.card.zh}」（${kwOf(now)}）。若順著目前的方向前進，未來將迎來「${fut.card.zh}」（${kwOf(fut)}）。`);
    let trend = fut.reversed
      ? `未來牌是逆位，提醒你目前的方向可能需要調整。回頭想想「${T.card.zh}」想教你的事，改變仍然來得及。`
      : `未來牌是正位，整體走向偏向正面。只要持續回應「${T.card.zh}」的課題，事情會朝好的方向發展。`;
    if (fut.card.element === T.card.element) trend += `未來牌與主題同屬「${ELEMENTS[T.card.element].zh}」元素，這個課題將在未來得到最直接的展現。`;
    out.push(trend);
  } else if (spreadKey === 'celtic') {
    const now = at('現況'), block = at('阻礙'), root = at('根基'), goal = at('目標'), res = at('結果'), fear = at('希望與恐懼');
    out.push(`問題的核心是「${now.card.zh}」（${kwOf(now)}），而「${block.card.zh}」（${kwOf(block)}）橫在面前，成為你必須跨越的挑戰。`);
    out.push(`你有意識在追求的是「${goal.card.zh}」（${kwOf(goal)}），但整件事的深層根源其實是「${root.card.zh}」（${kwOf(root)}）。你心中的期待與擔憂，則化身為「${fear.card.zh}」。`);
    out.push(res.reversed
      ? `最終的結果牌「${res.card.zh}」是逆位，代表若不調整，事情可能不如預期。好消息是，結果會隨著你的選擇而改變。`
      : `最終的結果牌「${res.card.zh}」是正位：${textOf(res)}`);
  } else {
    const p = picks[0];
    out.push(`今天的指引是「${p.card.zh}」（${orientOf(p)}）。${textOf(p)}`);
  }
  return out;
}

// 小牌與主題牌之間的關係（只用在一大三小）
function themeLink(p, picks, spreadKey) {
  if (spreadKey !== 'theme' || p.slot === 0) return '';
  const T = picks.find((q) => q.slot === 0);
  if (!T) return '';
  const rel = relationOf(T, p);
  return `與主題牌「${T.card.zh}」：${rel.text}${rel.notes.join('')}`;
}

// ---------- 問題分類 ----------
const TOPICS = {
  general: { zh: '綜合', icon: '✦' },
  love: { zh: '感情', icon: '💗', field: 'love' },
  career: { zh: '事業', icon: '💼', field: 'work' },
  study: { zh: '學業', icon: '📚', field: 'work' },
  self: { zh: '自我成長', icon: '🌱', field: 'advice' },
};

function topicLine(p, topic) {
  const t = TOPICS[topic];
  if (!t.field) return '';
  const caveat = p.reversed ? '（逆位：這股能量目前受阻，需要多加留意）' : '';
  return `${p.card[t.field]}${caveat}`;
}

// 針對問題分類的解讀：開頭一句總評，加上每張牌在這個面向上的意思
function topicReading(picks, spreadKey, spread, topic) {
  const t = TOPICS[topic];
  if (!t.field) return null;
  const at = (name) => picks.find((p) => spread.positions[p.slot].name === name);
  const last = at('未來') || at('結果') || picks[picks.length - 1];
  let intro;
  if (spreadKey === 'theme') {
    const T = at('主題');
    intro = `主題牌「${T.card.zh}」為你的${t.zh}定調：${T.card[t.field]}`;
  } else if (picks.length === 1) {
    intro = `今天在${t.zh}上的指引來自「${last.card.zh}」。`;
  } else {
    intro = `以「${at('現況').card.zh}」為核心，來看看你在${t.zh}上的狀況。`;
  }
  if (picks.length > 1) {
    intro += last.reversed
      ? `「${spread.positions[last.slot].name}」的${last.card.zh}是逆位，${t.zh}上目前的方向需要調整，多一點耐心與溝通，局面仍有轉圜的空間。`
      : `「${spread.positions[last.slot].name}」的${last.card.zh}是正位，整體來看${t.zh}的走向偏向正面。`;
  }
  const items = picks.map((p) => ({ label: `${spread.positions[p.slot].name}・${p.card.zh}`, text: topicLine(p, topic) }));
  return { intro, items };
}
