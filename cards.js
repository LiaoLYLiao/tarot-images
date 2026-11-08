// 舊版 Safari（iOS 15 以前）沒有 canvas 的 roundRect，補一個簡單版本
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}

// 78 張牌的資料：圖檔名、中英文名、元素、正逆位關鍵字
const ELEMENTS = {
  fire:  { zh: '火', desc: '熱情與行動', color: '#ff9a62' },
  water: { zh: '水', desc: '情感與直覺', color: '#7cc8ff' },
  air:   { zh: '風', desc: '思想與溝通', color: '#c9b8ff' },
  earth: { zh: '土', desc: '物質與穩定', color: '#9fdc9a' },
};

const MAJORS = [
  ['Fool', '愚者', 'The Fool', 'air', '新的開始、自由、冒險', '魯莽、猶豫、輕率'],
  ['Magician', '魔術師', 'The Magician', 'air', '創造、意志、資源具足', '操控、能力未發揮'],
  ['HighPriestess', '女祭司', 'The High Priestess', 'water', '直覺、潛意識、內在智慧', '忽視直覺、隱藏的秘密'],
  ['Empress', '皇后', 'The Empress', 'earth', '豐盛、滋養、美與創造', '依賴、創造力受阻'],
  ['Emperor', '皇帝', 'The Emperor', 'fire', '權威、結構、穩定', '控制欲、僵化'],
  ['Hierophant', '教皇', 'The Hierophant', 'earth', '傳統、信念、指引', '打破常規、質疑'],
  ['Lovers', '戀人', 'The Lovers', 'air', '愛、和諧、價值抉擇', '失衡、價值衝突'],
  ['Chariot', '戰車', 'The Chariot', 'water', '意志、勝利、前進', '失控、方向迷失'],
  ['Strength', '力量', 'Strength', 'fire', '勇氣、溫柔的力量、耐心', '自我懷疑、軟弱'],
  ['Hermit', '隱者', 'The Hermit', 'earth', '內省、獨處、尋找真理', '孤立、逃避'],
  ['WheelOfFortune', '命運之輪', 'Wheel of Fortune', 'fire', '轉機、循環、命運', '逆勢、抗拒改變'],
  ['Justice', '正義', 'Justice', 'air', '公平、真相、因果', '不公、逃避責任'],
  ['HangedMan', '吊人', 'The Hanged Man', 'water', '換個角度、暫停、臣服', '拖延、無謂犧牲'],
  ['Death', '死神', 'Death', 'water', '結束、轉化、新生', '抗拒結束、停滯'],
  ['Temperance', '節制', 'Temperance', 'fire', '平衡、調和、耐心', '失衡、過度'],
  ['Devil', '惡魔', 'The Devil', 'earth', '束縛、慾望、執著', '解脫、看清枷鎖'],
  ['Tower', '高塔', 'The Tower', 'fire', '劇變、覺醒、崩解', '避免災難、延遲的改變'],
  ['Star', '星星', 'The Star', 'air', '希望、療癒、靈感', '失去信心、沮喪'],
  ['Moon', '月亮', 'The Moon', 'water', '不安、幻象、潛意識', '釋放恐懼、真相浮現'],
  ['Sun', '太陽', 'The Sun', 'fire', '喜悅、成功、活力', '暫時陰霾、過度樂觀'],
  ['Judgement', '審判', 'Judgement', 'fire', '覺醒、重生、召喚', '自我批判、猶豫'],
  ['World', '世界', 'The World', 'earth', '完成、圓滿、整合', '未完成、缺少收尾'],
];

const SUITS = [
  ['Wands', '權杖', 'fire'],
  ['Cups', '聖杯', 'water'],
  ['Swords', '寶劍', 'air'],
  ['Pentacles', '錢幣', 'earth'],
];

const RANKS = [
  ['Ace', '一', 'Ace'], ['Two', '二', 'Two'], ['Three', '三', 'Three'], ['Four', '四', 'Four'],
  ['Five', '五', 'Five'], ['Six', '六', 'Six'], ['Seven', '七', 'Seven'], ['Eight', '八', 'Eight'],
  ['Nine', '九', 'Nine'], ['Ten', '十', 'Ten'], ['Page', '侍者', 'Page'], ['Knight', '騎士', 'Knight'],
  ['Queen', '皇后', 'Queen'], ['King', '國王', 'King'],
];

// [正位, 逆位]，順序同 RANKS
const MINOR_KEYWORDS = {
  Wands: [
    ['靈感、新的熱情、創造力的起點', '延遲、缺乏動力、方向不明'],
    ['規劃未來、抉擇、走出舒適圈', '害怕改變、計畫受阻'],
    ['拓展、遠見、等待成果', '進展受挫、眼界受限'],
    ['慶祝、穩定、家的歸屬', '不安定、過渡期'],
    ['競爭、衝突、意見分歧', '避免衝突、內在矛盾'],
    ['勝利、被肯定、自信', '自我懷疑、名不副實'],
    ['堅守立場、勇於挑戰', '疲於應付、想放棄'],
    ['快速進展、消息到來、行動', '延誤、急躁、計畫打亂'],
    ['韌性、最後防線、堅持', '精疲力盡、防衛過度'],
    ['重擔、責任過多、壓力', '卸下負擔、學會分擔'],
    ['好奇、探索、熱情的消息', '三分鐘熱度、缺乏方向'],
    ['衝勁、冒險、行動派', '魯莽、急躁、半途而廢'],
    ['自信、熱情、獨立魅力', '嫉妒、自我懷疑'],
    ['領袖、遠見、開創者', '專橫、衝動、期望過高'],
  ],
  Cups: [
    ['新的感情、愛、直覺湧現', '情感壓抑、空虛'],
    ['結合、互相吸引、夥伴', '失衡、誤解、分歧'],
    ['友誼、慶祝、歡聚', '過度放縱、小圈圈'],
    ['冷漠、沉思、錯失機會', '重新覺察、接受新機會'],
    ['失落、遺憾、悲傷', '釋懷、走出傷痛'],
    ['回憶、童真、舊情', '活在過去、走向未來'],
    ['幻想、選擇太多、誘惑', '認清現實、做出決定'],
    ['離開、尋找更深的意義', '猶豫不決、害怕離開'],
    ['願望成真、滿足', '貪心、表面的快樂'],
    ['幸福、家庭和諧、圓滿', '關係失和、理想落差'],
    ['浪漫的訊息、直覺、創意', '情緒化、不成熟'],
    ['浪漫、追求、迷人的邀約', '不切實際、情緒善變'],
    ['溫柔、同理、直覺', '情緒依賴、過度犧牲'],
    ['情緒成熟、包容、沉穩', '情緒操控、壓抑'],
  ],
  Swords: [
    ['突破、清晰、真相', '混亂、誤判'],
    ['僵局、難以抉擇、逃避', '資訊過載、做出決定'],
    ['心碎、悲傷、分離', '復原、原諒'],
    ['休息、沉澱、療癒', '重新出發、焦躁不安'],
    ['衝突、輸贏、自私', '和解、放下爭執'],
    ['過渡、離開困境、前進', '抗拒改變、未竟之事'],
    ['策略、隱瞞、獨行', '坦白、良心不安'],
    ['受困、自我設限', '解放、看見出口'],
    ['焦慮、失眠、擔憂', '走出恐懼、尋求協助'],
    ['結束、谷底、痛苦終結', '復甦、最壞已過'],
    ['好奇、求知、警覺', '八卦、說話不經思考'],
    ['果斷、迅速行動、直言', '衝動、莽撞'],
    ['獨立、清晰判斷、坦率', '冷漠、尖刻'],
    ['理性、權威、真理', '濫用權力、冷酷'],
  ],
  Pentacles: [
    ['新機會、財富種子、豐盛', '錯失機會、規劃不足'],
    ['平衡、彈性、多工', '失衡、手忙腳亂'],
    ['團隊合作、專業、學習', '缺乏合作、品質不佳'],
    ['守財、安全感、控制', '吝嗇、過度執著'],
    ['匱乏、困境、孤立', '復原、獲得幫助'],
    ['分享、慷慨、施與受', '不對等、附帶條件'],
    ['耐心、長期投資、評估', '急於求成、努力無回報'],
    ['專注、精進技藝、勤奮', '完美主義、缺乏熱情'],
    ['獨立、富足、自給自足', '過度工作、依賴'],
    ['傳承、家族、長久財富', '家庭糾紛、財務損失'],
    ['學習、務實的新開始', '拖延、缺乏進展'],
    ['穩健、負責、按部就班', '停滯、固執'],
    ['照顧、務實、豐饒', '失衡、過度操心'],
    ['富足、穩定、事業有成', '物質主義、固執'],
  ],
};

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

const CARDS = [
  ...MAJORS.map(([file, zh, en, element, up, rev], i) => ({
    file, zh, en, element, up, rev, major: true, number: ROMAN[i],
  })),
  ...SUITS.flatMap(([suit, suitZh, element]) =>
    RANKS.map(([rank, rankZh, rankEn], i) => ({
      file: rank + suit,
      zh: suitZh + rankZh,
      en: `${rankEn} of ${suit}`,
      element,
      up: MINOR_KEYWORDS[suit][i][0],
      rev: MINOR_KEYWORDS[suit][i][1],
      major: false,
      number: suitZh,
      suit,
      rank: i,
    }))),
].map((c) => {
  const [upText, revText, love, work, advice] = MEANINGS[c.file];
  return { ...c, upText, revText, love, work, advice, self: SELF_GROWTH[c.file] };
});

// 小牌的數字能量，順序同 RANKS
const RANK_MEANING = [
  ['開端與潛能', '一切剛剛萌芽，充滿可能性'],
  ['平衡與選擇', '面臨兩股力量的權衡'],
  ['成長與合作', '初步的成果開始成形'],
  ['穩定與結構', '進入穩固但也可能停滯的狀態'],
  ['衝突與變動', '穩定被打破，帶來挑戰'],
  ['和諧與修復', '在變動後重新找到平衡'],
  ['考驗與反思', '需要停下來評估與堅持'],
  ['推進與力量', '事情開始加速、累積實力'],
  ['接近完成', '即將到達終點，但仍需最後的努力'],
  ['循環的終點', '一個階段的結束，也是新循環的開始'],
  ['學習與訊息', '帶著好奇心探索的新手'],
  ['行動與追求', '朝目標全力奔馳的行動者'],
  ['內在的成熟', '以感受與包容來掌握這股能量'],
  ['外在的掌控', '以權威與經驗來運用這股能量'],
];

const SUIT_DOMAIN = {
  Wands: { zh: '權杖', area: '行動、熱情與事業企圖', lack: '缺少權杖：行動力與熱情不足，可能想得多、做得少。' },
  Cups: { zh: '聖杯', area: '情感、人際關係與直覺', lack: '缺少聖杯：情感層面可能被忽略了，留意自己真正的感受。' },
  Swords: { zh: '寶劍', area: '思考、溝通與衝突', lack: '缺少寶劍：需要更多理性分析與清楚的溝通。' },
  Pentacles: { zh: '錢幣', area: '金錢、工作與現實生活', lack: '缺少錢幣：想法需要落地，記得規劃實際可行的步驟。' },
};

// 牌陣：位置以牌寬 (x) 與牌高 (y) 為單位，edges 是星座連線
const SPREADS = {
  one: {
    name: '每日一牌',
    blurb: '今天的指引，一天只能抽一張',
    positions: [
      { name: '今日指引', desc: '今天宇宙想對你說的話', x: 0, y: 0 },
    ],
    edges: [],
  },
  // 一張大阿爾克那當主題，三張小阿爾克那描述過去、現在、未來。
  // x/y 是直式排法，wx/wy 是寬螢幕的橫式排法，s 是牌的放大倍率。
  theme: {
    name: '一大三小',
    blurb: '一張大牌定主題，三張小牌看過去、現在、未來',
    positions: [
      { name: '主題', desc: '這件事背後的核心課題', pool: 'major', s: 1.28, x: 0, y: -0.7, wx: -2.05, wy: 0 },
      { name: '過去', desc: '形塑現況的過往能量', pool: 'minor', x: -1.22, y: 0.72, wx: -0.2, wy: 0 },
      { name: '現在', desc: '你此刻所處的狀態', pool: 'minor', x: 0, y: 0.72, wx: 1.1, wy: 0 },
      { name: '未來', desc: '依目前方向可能的發展', pool: 'minor', x: 1.22, y: 0.72, wx: 2.4, wy: 0 },
    ],
    edges: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3]],
  },
  celtic: {
    name: '凱爾特十字',
    blurb: '十張牌完整剖析，適合重大或複雜的問題',
    positions: [
      { name: '現況', desc: '問題的核心', x: 0, y: 0 },
      { name: '阻礙', desc: '橫在面前的挑戰', x: 0, y: 0, rot: 90 },
      { name: '根基', desc: '潛意識裡的根源', x: 0, y: 1.06 },
      { name: '過去', desc: '正在離開的影響', x: -1.6, y: 0 },
      { name: '目標', desc: '意識層面的期望', x: 0, y: -1.06 },
      { name: '近未來', desc: '即將到來的發展', x: 1.6, y: 0 },
      { name: '自我', desc: '你面對此事的態度', x: 3.25, y: 1.56 },
      { name: '環境', desc: '周遭的人事物', x: 3.25, y: 0.52 },
      { name: '希望與恐懼', desc: '內心的期待與擔憂', x: 3.25, y: -0.52 },
      { name: '結果', desc: '最可能的走向', x: 3.25, y: -1.56 },
    ],
    // [0, 1] 沒有畫線（兩張重疊），只在牌的詳細資訊裡顯示
    edges: [[3, 0], [0, 5], [4, 0], [0, 2], [2, 6], [6, 7], [7, 8], [8, 9], [9, 4], [0, 1]],
  },
  love: {
    name: '關係牌陣',
    blurb: '看你和對方的心意、關係現況與未來發展',
    positions: [
      { name: '關係現況', desc: '這段關係目前的狀態', x: 0, y: -0.56, wx: -1.2, wy: 0 },
      { name: '你的心意', desc: '你在這段關係裡的感受', x: -1.2, y: -0.56, wx: -2.4, wy: 0 },
      { name: '對方的心意', desc: '對方在這段關係裡的感受', x: 1.2, y: -0.56, wx: 0, wy: 0 },
      { name: '阻礙', desc: '兩人之間需要面對的課題', x: -0.6, y: 0.56, wx: 1.2, wy: 0 },
      { name: '未來發展', desc: '這段關係可能的走向', x: 0.6, y: 0.56, wx: 2.4, wy: 0 },
    ],
    edges: [[1, 0], [0, 2], [0, 3], [0, 4], [3, 4]],
  },
  career: {
    name: '職涯牌陣',
    blurb: '盤點優勢與挑戰，找出事業的下一步',
    positions: [
      { name: '現況', desc: '你在工作上的處境', x: 0, y: -0.56, wx: -1.2, wy: 0 },
      { name: '優勢', desc: '你可以發揮的長處與資源', x: -1.2, y: -0.56, wx: -2.4, wy: 0 },
      { name: '挑戰', desc: '需要克服的困難', x: 1.2, y: -0.56, wx: 0, wy: 0 },
      { name: '建議', desc: '接下來該怎麼做', x: -0.6, y: 0.56, wx: 1.2, wy: 0 },
      { name: '結果', desc: '照這個方向可能的結果', x: 0.6, y: 0.56, wx: 2.4, wy: 0 },
    ],
    edges: [[1, 0], [0, 2], [0, 3], [3, 4], [2, 4]],
  },
  study: {
    name: '學業牌陣',
    blurb: '看清學習狀態，找到適合你的讀書方法',
    positions: [
      { name: '目前狀態', desc: '你現在的學習狀況', x: 0, y: -0.56, wx: -1.2, wy: 0 },
      { name: '學習優勢', desc: '你擅長、可以依靠的地方', x: -1.2, y: -0.56, wx: -2.4, wy: 0 },
      { name: '需要加強', desc: '讓你卡住的地方', x: 1.2, y: -0.56, wx: 0, wy: 0 },
      { name: '方法建議', desc: '更有效的學習方式', x: -0.6, y: 0.56, wx: 1.2, wy: 0 },
      { name: '可能結果', desc: '持續努力後的成果', x: 0.6, y: 0.56, wx: 2.4, wy: 0 },
    ],
    edges: [[1, 0], [0, 2], [0, 3], [3, 4], [2, 4]],
  },
  choice: {
    name: '二選一',
    blurb: '比較兩個選項的發展與結果（在問題裡寫下 A 和 B）',
    positions: [
      { name: '現況', desc: '你做選擇時的處境', x: 0, y: 0, wx: 0, wy: 0 },
      { name: 'A 的發展', desc: '選擇 A 之後的過程', x: -1.2, y: 0.56, wx: -1.2, wy: 0 },
      { name: 'A 的結果', desc: '選擇 A 最後的結果', x: -1.2, y: -0.56, wx: -2.4, wy: 0 },
      { name: 'B 的發展', desc: '選擇 B 之後的過程', x: 1.2, y: 0.56, wx: 1.2, wy: 0 },
      { name: 'B 的結果', desc: '選擇 B 最後的結果', x: 1.2, y: -0.56, wx: 2.4, wy: 0 },
    ],
    edges: [[0, 1], [1, 2], [0, 3], [3, 4]],
  },
  self: {
    name: '身心靈牌陣',
    blurb: '從身體、心理、靈性三個層面認識自己',
    positions: [
      { name: '核心課題', desc: '你現在最重要的成長功課', s: 1.18, x: 0, y: -0.66, wx: -2, wy: 0 },
      { name: '身體', desc: '身體與生活狀態想告訴你的事', x: -1.2, y: 0.66, wx: -0.25, wy: 0 },
      { name: '心理', desc: '情緒與想法的狀態', x: 0, y: 0.66, wx: 1.05, wy: 0 },
      { name: '靈性', desc: '內在與信念層面的指引', x: 1.2, y: 0.66, wx: 2.35, wy: 0 },
    ],
    edges: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3]],
  },
  heart: {
    name: '對方的心',
    blurb: '看懂對方怎麼看你、真正的感受與接下來的打算',
    positions: [
      { name: '他怎麼看你', desc: '對方眼中的你', x: -1.2, y: 0 },
      { name: '真正的感受', desc: '對方心裡的感覺', x: 0, y: 0 },
      { name: '接下來的打算', desc: '對方之後可能的行動', x: 1.2, y: 0 },
    ],
    edges: [[0, 1], [1, 2]],
  },
  people: {
    name: '職場人際',
    blurb: '看清你在團隊中的位置，以及和同事、主管的相處之道',
    positions: [
      { name: '你的位置', desc: '你在職場裡的狀態', x: -1.2, y: 0 },
      { name: '周遭的人', desc: '同事與主管的能量', x: 0, y: 0 },
      { name: '相處之道', desc: '改善關係的方法', x: 1.2, y: 0 },
    ],
    edges: [[0, 1], [1, 2]],
  },
  exam: {
    name: '考試運勢',
    blurb: '看準備狀態、該注意的地方與考試結果',
    positions: [
      { name: '準備狀態', desc: '你目前準備得如何', x: -1.2, y: 0 },
      { name: '需要注意', desc: '考前最該留意的事', x: 0, y: 0 },
      { name: '考試結果', desc: '照目前努力可能的結果', x: 1.2, y: 0 },
    ],
    edges: [[0, 1], [1, 2]],
  },
  heal: {
    name: '情緒療癒',
    blurb: '溫柔地看見現在的情緒、它的根源與療癒的方法',
    positions: [
      { name: '現在的情緒', desc: '你此刻真實的感受', x: -1.2, y: 0 },
      { name: '情緒的根源', desc: '這份感受從哪裡來', x: 0, y: 0 },
      { name: '療癒的方法', desc: '照顧自己的方式', x: 1.2, y: 0 },
    ],
    edges: [[0, 1], [1, 2]],
  },
};

// 每個情境適用的牌陣（輪盤裡只會列出這些），第一個最推薦
const TOPIC_SPREADS = {
  general: ['theme', 'celtic', 'choice'],
  love: ['love', 'heart', 'theme'],
  career: ['career', 'people', 'celtic'],
  study: ['study', 'exam', 'choice'],
  self: ['self', 'heal', 'theme'],
};

function relationOf(a, b) {
  const ea = a.card.element, eb = b.card.element;
  const pair = [ea, eb].sort().join('-');
  let text;
  if (ea === eb) text = '同元素共鳴：能量互相放大，這個主題會特別強烈。';
  else if (pair === 'air-fire' || pair === 'earth-water') text = '相生：彼此支持，一方為另一方提供燃料。';
  else if (pair === 'fire-water' || pair === 'air-earth') text = '相剋：兩股力量拉扯，需要在其間找到平衡。';
  else text = '互補：看似無關，卻能補足彼此缺少的部分。';
  const notes = [];
  if (a.card.major && b.card.major) notes.push('兩張大阿爾克那相連，這是命運層級的課題。');
  if (a.reversed && b.reversed) notes.push('兩者皆為逆位，能量向內收，宜先處理內在的阻滯。');
  return { text, notes };
}
