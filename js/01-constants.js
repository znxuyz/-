/* ============================================
   寵物資料(台灣特有種八神)
============================================ */
const PET_SPECIES = [
  { id: 'bear',     name: '台灣黑熊',     icon: '🐻', desc: '胸前有 V 形白毛,森林之王' },
  { id: 'cat',      name: '石虎',         icon: '🐱', desc: '夜行獵手,瀕危山林精靈' },
  { id: 'salmon',   name: '櫻花鉤吻鮭',   icon: '🐟', desc: '冰河時期遺族,清流貴族' },
  { id: 'pheasant', name: '帝雉',         icon: '🦃', desc: '霧中之鳥,千元紙鈔代言' },
  { id: 'magpie',   name: '台灣藍鵲',     icon: '🐦', desc: '長尾國寶,團隊行動之鳥' },
  { id: 'pangolin', name: '穿山甲',       icon: '🦔', desc: '鱗甲護身,夜晚的工程師' },
  { id: 'deer',     name: '山羌',         icon: '🦌', desc: '小巧山林獸,叫聲如犬' },
  { id: 'macaque',  name: '台灣獼猴',     icon: '🐵', desc: '群居靈長,聰穎山中靈' }
];

const STAGE_NAMES = ['靈卵', '幼獸', '成獸', '守護神獸'];
const STAGE_THRESHOLDS = [0, 15, 50, 150]; // 累積積分達到此值時進化

/* 圖片檔名用的階段代號,對應 assets/pets/{物種}-{階段}.png */
const STAGE_KEYS = ['egg', 'baby', 'adult', 'guardian'];

const STAGE_ICONS = {
  bear:     ['🥚', '🐻', '🐻', '🐻'],
  cat:      ['🥚', '🐱', '🐱', '🐱'],
  salmon:   ['🥚', '🐟', '🐟', '🐟'],
  pheasant: ['🥚', '🐣', '🦃', '🦃'],
  magpie:   ['🥚', '🐤', '🐦', '🐦'],
  pangolin: ['🥚', '🦔', '🦔', '🦔'],
  deer:     ['🥚', '🦌', '🦌', '🦌'],
  macaque:  ['🥚', '🐒', '🐵', '🐵']
};

const DEFAULT_RULES = [
  { name: '上課專心', points: 1 },
  { name: '舉手發言', points: 2 },
  { name: '完成作業', points: 2 },
  { name: '主動幫助同學', points: 3 },
  { name: '閱讀心得分享', points: 5 },
  { name: '小組合作優異', points: 3 },
  { name: '生活常規良好', points: 1 },
  { name: '違反班規', points: -2 }
];
