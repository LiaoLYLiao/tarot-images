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
  關係現況: (kw) => `你們的關係目前處在「${kw}」的狀態`,
  你的心意: (kw) => `你在這段關係裡的感受是「${kw}」`,
  對方的心意: (kw) => `對方心裡的感受是「${kw}」`,
  未來發展: (kw) => `照目前的相處方式，關係可能朝「${kw}」發展`,
  優勢: (kw) => `你可以好好發揮的長處是「${kw}」`,
  挑戰: (kw) => `需要克服的課題是「${kw}」`,
  建議: (kw) => `接下來的行動方向是「${kw}」`,
  目前狀態: (kw) => `你現在的學習狀態是「${kw}」`,
  學習優勢: (kw) => `你可以依靠的學習優勢是「${kw}」`,
  需要加強: (kw) => `讓你卡住、需要加強的是「${kw}」`,
  方法建議: (kw) => `適合你的學習方式與「${kw}」有關`,
  可能結果: (kw) => `持續努力下去，成果會朝「${kw}」發展`,
  'A 的發展': (kw) => `選擇 A 之後，過程會經歷「${kw}」`,
  'A 的結果': (kw) => `選擇 A 最後的結果是「${kw}」`,
  'B 的發展': (kw) => `選擇 B 之後，過程會經歷「${kw}」`,
  'B 的結果': (kw) => `選擇 B 最後的結果是「${kw}」`,
  他怎麼看你: (kw) => `在對方眼中，你給人「${kw}」的感覺`,
  真正的感受: (kw) => `對方心裡真正的感受是「${kw}」`,
  接下來的打算: (kw) => `對方接下來可能會朝「${kw}」的方向行動`,
  你的位置: (kw) => `你在職場中正處於「${kw}」的狀態`,
  周遭的人: (kw) => `周遭同事與主管帶來「${kw}」的能量`,
  相處之道: (kw) => `改善關係的關鍵在於「${kw}」`,
  準備狀態: (kw) => `你目前的準備狀態是「${kw}」`,
  需要注意: (kw) => `考前最需要留意的是「${kw}」`,
  考試結果: (kw) => `照目前的努力，結果會朝「${kw}」發展`,
  現在的情緒: (kw) => `你此刻真實的感受是「${kw}」`,
  情緒的根源: (kw) => `這份感受的根源與「${kw}」有關`,
  療癒的方法: (kw) => `照顧自己的方式是「${kw}」`,
  核心課題: (kw) => `你現在最重要的成長功課是「${kw}」`,
  身體: (kw) => `身體與生活狀態在提醒你「${kw}」`,
  心理: (kw) => `你的情緒與想法正處在「${kw}」`,
  靈性: (kw) => `內在與信念層面給你的指引是「${kw}」`,
};

// 某張牌在某個面向（love／work／self）的意思；逆位時用逆位的寫法（建議沒有分正逆位）
const aspectOf = (p, field) => (p.reversed && p.card[`${field}Rev`]) || p.card[field];
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
  } else if (spreadKey === 'quick') {
    const p = picks[0], v = quickVerdict(p.card, p.reversed);
    out.push(`抽到「${p.card.zh}」（${orientOf(p)}），答案是「${v.zh}」。${v.line}`);
    out.push(textOf(p));
  } else if (spreadKey === 'choice') {
    const now = at('現況'), aMid = at('A 的發展'), aEnd = at('A 的結果'), bMid = at('B 的發展'), bEnd = at('B 的結果');
    out.push(`你站在「${now.card.zh}」（${kwOf(now)}）的處境上做選擇。`);
    out.push(`選擇 A：過程是「${aMid.card.zh}」（${kwOf(aMid)}），最後走向「${aEnd.card.zh}」（${kwOf(aEnd)}）。`);
    out.push(`選擇 B：過程是「${bMid.card.zh}」（${kwOf(bMid)}），最後走向「${bEnd.card.zh}」（${kwOf(bEnd)}）。`);
    // 結果牌比過程牌重要；正位加分、逆位扣分
    const score = (mid, end) => (mid.reversed ? -1 : 1) + (end.reversed ? -2 : 2);
    const a = score(aMid, aEnd), b = score(bMid, bEnd);
    out.push(a === b
      ? '兩個選項的能量相當，沒有哪一邊明顯比較順。這時候不妨回到你心裡真正在乎的事，它會比牌更清楚地告訴你答案。'
      : `整體來看，選擇 ${a > b ? 'A' : 'B'} 的能量比較順暢。不過這只是參考，牌呈現的是此刻的趨勢，真正做決定的永遠是你。`);
  } else if (picks.length > 1) {
    // 關係、職涯、學業、身心靈：依牌位順序串成一段，再看最後一張牌的走向
    out.push(picks.map((p) => `「${spread.positions[p.slot].name}」是「${p.card.zh}」（${kwOf(p)}）`).join('；') + '。');
    const core = picks[0], last = picks[picks.length - 1];
    out.push(`這一切的核心是「${core.card.zh}」：${textOf(core)}`);
    out.push(last.reversed
      ? `最後一張「${spread.positions[last.slot].name}」是逆位，提醒你目前的方向需要調整，改變仍然來得及。`
      : `最後一張「${spread.positions[last.slot].name}」是正位，整體走向偏向正面。`);
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
  general: { zh: '綜合' },
  love: { zh: '感情', field: 'love' },
  career: { zh: '事業', field: 'work' },
  study: { zh: '學業', field: 'work' },
  self: { zh: '自我成長', field: 'self' },
};

function topicLine(p, topic) {
  const t = TOPICS[topic];
  if (!t.field) return '';
  return aspectOf(p, t.field);
}

// 針對問題分類的解讀：開頭一句總評，加上每張牌在這個面向上的意思
function topicReading(picks, spreadKey, spread, topic) {
  const t = TOPICS[topic];
  if (!t.field) return null;
  const at = (name) => picks.find((p) => spread.positions[p.slot].name === name);
  const last = at('未來') || at('結果') || picks[picks.length - 1];
  const core = at('現況') || picks[0];
  let intro;
  if (spreadKey === 'theme') {
    const T = at('主題');
    intro = `主題牌「${T.card.zh}」為你的${t.zh}定調：${aspectOf(T, t.field)}`;
  } else if (picks.length === 1) {
    intro = `今天在${t.zh}上的指引來自「${last.card.zh}」。`;
  } else {
    intro = `以「${core.card.zh}」為核心，來看看你在${t.zh}上的狀況。`;
  }
  if (picks.length > 1 && spreadKey !== 'choice') {
    intro += last.reversed
      ? `「${spread.positions[last.slot].name}」的${last.card.zh}是逆位，${t.zh}上目前的方向需要調整，多一點耐心與溝通，局面仍有轉圜的空間。`
      : `「${spread.positions[last.slot].name}」的${last.card.zh}是正位，整體來看${t.zh}的走向偏向正面。`;
  }
  const items = picks.map((p) => ({ label: `${spread.positions[p.slot].name}・${p.card.zh}`, text: topicLine(p, topic) }));
  return { intro, items };
}

// 問題靈感：用開放式問法（「如何」「什麼」），比「會不會」的是非題更適合塔羅
const QUESTION_IDEAS = {
  general: ['我現在最需要知道的是什麼？', '接下來三個月，我該把重心放在哪裡？', '眼前的困境要怎麼突破？', '我忽略了什麼重要的事？', '這個選擇會帶我走向哪裡？', '宇宙現在想提醒我什麼？'],
  love: ['我們的關係接下來會如何發展？', '對方現在對我的感覺是什麼？', '我該怎麼做，才能讓這段感情更好？', '我在感情裡需要學習的課題是什麼？', '我要怎麼做才能遇到對的人？', '這段感情值得我繼續投入嗎？'],
  career: ['我目前的工作方向適合我嗎？', '換工作對我來說是好的選擇嗎？', '我該如何在職場上更進一步？', '這個專案或合作會怎麼發展？', '我的天賦適合往哪個方向發展？', '職場上的人際問題該怎麼處理？'],
  study: ['我該怎麼準備，才能考出好成績？', '這個科系或方向適合我嗎？', '我讀書效率不好的原因是什麼？', '要不要繼續進修或出國念書？', '我該如何平衡課業與生活？'],
  self: ['我現在最需要放下的是什麼？', '我內心真正渴望的是什麼？', '我該如何更愛自己？', '阻礙我成長的模式是什麼？', '接下來我該培養什麼能力？'],
};

// ---------- 總結：放在完整解讀最前面的一段話 ----------
const CORE_POS = ['主題', '核心課題', '現況', '關係現況', '目前狀態', '今日指引', '真正的感受', '你的位置', '準備狀態', '現在的情緒'];
const END_POS = ['未來', '結果', '未來發展', '可能結果', '接下來的打算', '相處之道', '考試結果', '療癒的方法'];

function summaryReading(picks, spreadKey, spread, topic) {
  const posOf = (p) => spread.positions[p.slot].name;
  const core = picks.find((p) => CORE_POS.includes(posOf(p))) || picks.find((p) => p.card.major) || picks[0];
  const end = picks.find((p) => END_POS.includes(posOf(p)));
  // 整體走向：正位加分、逆位扣分，最後一張牌的份量加倍
  const score = picks.reduce((s, p) => s + (p.reversed ? -1 : 1) * (p === end ? 2 : 1), 0);
  const max = picks.length + (end ? 1 : 0);
  const tone = score >= max * 0.5 ? '整體偏向正面，事情正朝好的方向流動'
    : score > 0 ? '整體有起有落，順利之中也藏著需要留意的地方'
    : '整體能量有些卡住，這是提醒你停下來調整方向的時候';
  const t = TOPICS[topic];
  const lines = [];
  if (spreadKey === 'quick') {
    const v = quickVerdict(core.card, core.reversed);
    lines.push(`答案是「${v.zh}」：${v.line}`);
  } else if (picks.length === 1) {
    lines.push(`今天的關鍵字是「${kwOf(core)}」。`);
  } else {
    lines.push(`${tone}。`);
    lines.push(`這次的關鍵在「${core.card.zh}」（${orientOf(core)}）：${kwOf(core)}。`);
  }
  if (spreadKey === 'choice') {
    const at = (n) => picks.find((p) => posOf(p) === n);
    const sc = (a, b) => (a.reversed ? -1 : 1) + (b.reversed ? -2 : 2);
    const a = sc(at('A 的發展'), at('A 的結果')), b = sc(at('B 的發展'), at('B 的結果'));
    lines.push(a === b ? '兩個選項的能量相當，回到你真正在乎的事來決定。' : `比較起來，選擇 ${a > b ? 'A' : 'B'} 的能量比較順暢。`);
  } else if (end && end !== core) {
    lines.push(`走向上，「${end.card.zh}」${end.reversed ? '是逆位，提醒你目前的方向需要調整' : `帶來「${kwOf(end)}」`}。`);
  }
  if (t.field) lines.push(`在${t.zh}上：${topicLine(core, topic)}`);
  const adviceCard = end || core;
  return { text: lines.join(''), advice: adviceCard.card.advice, core, end };
}

// ---------- 隨手一抽：用一張牌回答「要不要做」 ----------
// 這些牌正位時偏向阻礙或提醒，其餘的牌正位時偏向支持
const CAUTION = new Set(['Tower', 'Devil', 'Moon', 'Death', 'HangedMan', 'FiveWands', 'TenWands', 'FourCups', 'FiveCups',
  'EightCups', 'ThreeSwords', 'FiveSwords', 'SevenSwords', 'EightSwords', 'NineSwords', 'TenSwords', 'TwoSwords', 'FivePentacles', 'FourPentacles']);
function quickVerdict(card, reversed) {
  const good = !CAUTION.has(card.file);
  if (good && !reversed) return { key: 'yes', en: 'Yes', zh: '去做吧', line: '牌面的能量是順的，相信自己，放手去做吧。' };
  if (good && reversed) return { key: 'wait', en: 'Not yet', zh: '時機未到', line: '方向沒有錯，只是時機還沒成熟，再等一等、多準備一點。' };
  if (!good && reversed) return { key: 'think', en: 'Think again', zh: '再想想', line: '阻礙正在鬆動，但還有沒看清楚的地方，多想一下再決定。' };
  return { key: 'no', en: 'No', zh: '先不要', line: '這次的能量不太支持，先停下來，不做也是一種選擇。' };
}
