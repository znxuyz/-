/* ============================================
   領地佔領戰
   ────────────────────────────────────────────
   分組後才能玩。答對題目累積佔領分,在戰役時間內分數最高的一組
   拿下那塊地。地圖由外圈往中心分階段開放。

   為什麼沒有裁判?
   地圖不是誰寫出來的,而是「重播」出來的 ——
   每個人都拿到同一份作答事件,依伺服器時間排序後跑同一套規則,
   必然得到同一張地圖。老師不用開著頁面,學生之間也不會打架,
   先後順序由伺服器時間決定,不受各自裝置的時鐘影響。

   那怎麼防止亂寫?兩道防線各司其職:
     · 安全規則:比對老師事先設定好的正確答案,答錯的事件根本寫不進來,
       組別與佔領分也由規則從伺服器端的資料核對。正確答案存在學生
       讀不到的文件裡,但規則讀得到。
     · 重播規則:相鄰、開放階段、基地保護、戰役時間都在重播時判定。
       就算有人硬塞一筆不合規的事件,重播時也會被忽略。
============================================ */

/* ---------- 六角格座標 ----------
   axial 座標 (q, r),尖角朝上。六個鄰居方向固定,
   不像 offset 座標要為奇偶列分開處理,相鄰判斷不會寫錯。 */

const HEX_DIRECTIONS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
];

const Hex = {
  key(q, r) { return `${q}_${r}`; },

  parse(key) {
    const [q, r] = key.split('_').map(Number);
    return { q, r };
  },

  neighbors(q, r) {
    return HEX_DIRECTIONS.map(([dq, dr]) => this.key(q + dq, r + dr));
  },

  /* 距離中心幾圈。用來決定階段開放 */
  ring(q, r) {
    return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
  },

  buildMap(radius) {
    const cells = [];
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      for (let r = r1; r <= r2; r++) cells.push(this.key(q, r));
    }
    return cells;
  },

  toPixel(q, r, size) {
    return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
  },

  corners(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 90);
      pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
  }
};

const GROUP_COLORS = [
  '#c25b4e', '#4a7c62', '#5b8ba8', '#c8a44d',
  '#8a5a72', '#d97742', '#6b7f4a', '#7a6aa8'
];

const DIFFICULTY = {
  easy:   { label: '簡單', points: 1, color: '#7d9b8a' },
  medium: { label: '普通', points: 2, color: '#c8a44d' },
  hard:   { label: '困難', points: 3, color: '#c25b4e' }
};

/* ============================================
   遊戲引擎
============================================ */

const Territory = {

  /* ---------- 開局設定 ---------- */

  createConfig(groups, opts) {
    const radius = opts.radius || 4;
    const cells = Hex.buildMap(radius);
    const bases = {};
    this.pickStarts(cells, groups.length, radius).forEach((key, i) => {
      if (key) bases[key] = i;
    });

    const memberGroup = {};
    groups.forEach((members, i) => {
      (members || []).forEach(m => {
        const id = typeof m === 'string' ? m : (m && m.id);
        if (id) memberGroup[id] = i;
      });
    });

    return {
      radius,
      threshold: opts.threshold || 5,           // 拿下一格至少要累積幾分
      battleSeconds: opts.battleSeconds || 90,  // 一場地塊爭奪持續多久
      stageMode: opts.stageMode || 'auto',      // auto = 依倒數自動開放 / manual = 老師手動
      stageSeconds: opts.stageSeconds || 300,   // 自動模式下每圈開放的間隔
      openDepth: 1,                             // 手動模式用:已開放到第幾層
      groupCount: groups.length,
      bases,
      memberGroup,
      status: 'running',
      startedAt: Date.now()
    };
  },

  pickStarts(cells, groupCount, radius) {
    const ring = cells.filter(k => {
      const { q, r } = Hex.parse(k);
      return Hex.ring(q, r) === radius;
    });
    // 依角度排序,才是真的沿著外圈等距分佈
    ring.sort((a, b) => {
      const pa = Hex.parse(a), pb = Hex.parse(b);
      const A = Hex.toPixel(pa.q, pa.r, 1), B = Hex.toPixel(pb.q, pb.r, 1);
      return Math.atan2(A.y, A.x) - Math.atan2(B.y, B.x);
    });
    const step = ring.length / groupCount;
    return Array.from({ length: groupCount }, (_, i) => ring[Math.floor(i * step)]);
  },

  /* ---------- 階段開放 ----------
     從最外圈往中心開。自動模式下由經過的時間算出來,
     所以不需要任何人定時去寫資料 —— 每台裝置各自算,結果一樣。 */

  openDepthAt(config, atTime) {
    if (config.stageMode === 'manual') return config.openDepth || 1;
    const elapsed = Math.max(0, (atTime - config.startedAt) / 1000);
    return Math.min(config.radius + 1, 1 + Math.floor(elapsed / config.stageSeconds));
  },

  isOpen(config, hexKey, atTime) {
    const { q, r } = Hex.parse(hexKey);
    // 外圈的 ring 值最大,openDepth 每加一就往中心多開一圈
    return Hex.ring(q, r) >= config.radius - this.openDepthAt(config, atTime);
  },

  /* 下一階段什麼時候開。手動模式或已全開時回傳 null */
  nextStageAt(config) {
    if (config.stageMode === 'manual') return null;
    const depth = this.openDepthAt(config, Date.now());
    if (depth > config.radius) return null;
    return config.startedAt + depth * config.stageSeconds * 1000;
  },

  /* ---------- 重播 ----------
     events 必須已依伺服器時間排序。回傳當下的地圖與易主紀錄。 */

  replay(config, events, now) {
    now = now || Date.now();

    const map = {};
    Hex.buildMap(config.radius).forEach(k => {
      map[k] = { owner: null, battle: null };
    });
    Object.entries(config.bases || {}).forEach(([k, g]) => {
      if (map[k]) map[k] = { owner: Number(g), battle: null, isBase: true };
    });

    const log = [];

    (events || []).forEach(ev => {
      const at = ev.at;
      // 先結算這個時間點之前就該結束的戰役,順序才正確
      this.resolveBattles(config, map, at, log);

      const cell = map[ev.hexKey];
      if (!cell) return;                                          // 不存在的格子
      if (cell.isBase) return;                                    // 基地不可攻佔
      if (cell.owner === ev.groupIdx) return;                     // 自己的地不用打
      if (!this.isOpen(config, ev.hexKey, at)) return;            // 還沒開放的區域
      if (!this.adjacentTo(map, ev.hexKey, ev.groupIdx)) return;  // 必須與自己領地相鄰

      if (!cell.battle) {
        cell.battle = { endsAt: at + config.battleSeconds * 1000, points: {} };
      }
      const g = String(ev.groupIdx);
      cell.battle.points[g] = (cell.battle.points[g] || 0) + ev.points;
    });

    this.resolveBattles(config, map, now, log);

    return { map, log };
  },

  /* 結算所有已到期的戰役。達到門檻且分數最高的一組拿下;
     同分或都沒達標就沒人拿到,地塊維持原狀。 */
  resolveBattles(config, map, atTime, log) {
    Object.keys(map).forEach(k => {
      const cell = map[k];
      if (!cell.battle || cell.battle.endsAt > atTime) return;

      const ranked = Object.entries(cell.battle.points)
        .map(([g, p]) => ({ groupIdx: Number(g), points: p }))
        .filter(e => e.points >= config.threshold)
        .sort((a, b) => b.points - a.points);

      const tied = ranked[1] && ranked[1].points === ranked[0].points;

      if (ranked.length > 0 && !tied) {
        log.push({
          at: cell.battle.endsAt, hexKey: k,
          from: cell.owner, to: ranked[0].groupIdx, points: ranked[0].points
        });
        cell.owner = ranked[0].groupIdx;
      } else if (ranked.length > 0) {
        log.push({ at: cell.battle.endsAt, hexKey: k, draw: true });
      }
      cell.battle = null;
    });
  },

  adjacentTo(map, hexKey, groupIdx) {
    const { q, r } = Hex.parse(hexKey);
    return Hex.neighbors(q, r).some(n => map[n] && map[n].owner === groupIdx);
  },

  /* ---------- 查詢 ---------- */

  targetsFor(config, map, groupIdx, now) {
    now = now || Date.now();
    const targets = new Set();
    Object.keys(map).forEach(k => {
      if (map[k].owner !== groupIdx) return;
      const { q, r } = Hex.parse(k);
      Hex.neighbors(q, r).forEach(n => {
        const t = map[n];
        if (!t || t.owner === groupIdx || t.isBase) return;
        if (!this.isOpen(config, n, now)) return;
        targets.add(n);
      });
    });
    return targets;
  },

  standings(config, map) {
    const counts = Array.from({ length: config.groupCount }, () => 0);
    Object.values(map).forEach(c => {
      if (c.owner !== null && counts[c.owner] !== undefined) counts[c.owner]++;
    });
    return counts
      .map((count, groupIdx) => ({ groupIdx, count }))
      .sort((a, b) => b.count - a.count);
  }
};

/* ============================================
   地圖繪製(老師端與學生端共用)
============================================ */

function renderHexMap(config, map, opts) {
  const o = opts || {};
  const now = Date.now();
  const size = 26;
  const cells = Object.keys(map);

  const pos = {};
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  cells.forEach(k => {
    const { q, r } = Hex.parse(k);
    const p = Hex.toPixel(q, r, size);
    pos[k] = p;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const pad = size * 1.4;
  const vb = [minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2];

  const targets = o.groupIdx != null
    ? Territory.targetsFor(config, map, o.groupIdx, now) : new Set();

  const polys = cells.map(k => {
    const cell = map[k];
    const p = pos[k];
    const open = Territory.isOpen(config, k, now);
    const owned = cell.owner !== null;
    const fill = !open ? '#cfc9ba'
               : owned ? GROUP_COLORS[cell.owner % GROUP_COLORS.length]
               : '#e8e2d4';
    const canAttack = targets.has(k);

    // 交戰中的格子:各組分數畫成一條比例長條,誰領先一目了然
    let battleMarks = '';
    if (cell.battle) {
      const ranked = Object.entries(cell.battle.points)
        .map(([g, pts]) => ({ g: Number(g), pts }))
        .sort((a, b) => b.pts - a.pts);
      const total = ranked.reduce((s, e) => s + e.pts, 0) || 1;
      let x = p.x - size * 0.62;
      battleMarks = ranked.map(e => {
        const w = (size * 1.24) * (e.pts / total);
        const rect = `<rect x="${x.toFixed(1)}" y="${(p.y + size * 0.42).toFixed(1)}"
          width="${w.toFixed(1)}" height="5" fill="${GROUP_COLORS[e.g % GROUP_COLORS.length]}" />`;
        x += w;
        return rect;
      }).join('') +
      `<text x="${p.x}" y="${(p.y + 5).toFixed(1)}" class="hex-battle-mark">⚔</text>`;
    }

    return `
      <g class="hex ${canAttack ? 'attackable' : ''} ${cell.isBase ? 'base' : ''}
                 ${open ? '' : 'locked'} ${cell.battle ? 'in-battle' : ''}"
         ${canAttack && o.onClick ? `onclick="${o.onClick}('${k}')"` : ''}>
        <polygon points="${Hex.corners(p.x, p.y, size)}"
                 fill="${fill}" stroke="#faf7f0" stroke-width="2"
                 opacity="${!open ? 0.35 : owned ? 0.9 : 0.55}" />
        ${cell.isBase ? `<text x="${p.x}" y="${p.y + 5}" class="hex-base-mark">★</text>` : ''}
        ${battleMarks}
      </g>`;
  }).join('');

  return `<svg class="hex-map" viewBox="${vb.join(' ')}"
               preserveAspectRatio="xMidYMid meet">${polys}</svg>`;
}

function renderStandings(config, map, highlightGroup) {
  const total = Object.keys(map).length;
  return `<div class="territory-standings">` +
    Territory.standings(config, map).map(s => {
      const pct = total > 0 ? (s.count / total * 100) : 0;
      const color = GROUP_COLORS[s.groupIdx % GROUP_COLORS.length];
      return `
        <div class="standing-row ${s.groupIdx === highlightGroup ? 'is-me' : ''}">
          <span class="standing-name" style="color:${color}">第 ${s.groupIdx + 1} 組</span>
          <span class="standing-bar">
            <span class="standing-fill" style="width:${pct}%; background:${color}"></span>
          </span>
          <span class="standing-count">${s.count}</span>
        </div>`;
    }).join('') + `</div>`;
}

/* 剩餘時間寫成 3:05 */
function formatCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ============================================
   老師端
============================================ */

function createTerritoryQuestion() {
  const text = document.getElementById('tqText').value.trim();
  const diff = document.getElementById('tqDifficulty').value;
  const opts = ['tqA', 'tqB', 'tqC', 'tqD'].map(id => document.getElementById(id).value.trim());
  const answer = parseInt(document.querySelector('input[name="tqAnswer"]:checked')?.value ?? '0');

  if (!text) { toast('請輸入題目'); return; }
  if (opts.filter(Boolean).length < 2) { toast('至少要有兩個選項'); return; }
  if (!opts[answer]) { toast('被標為正確答案的那一格是空的'); return; }

  state.territoryQuestions.unshift({
    id: 'tq_' + Date.now(), text, options: opts, answer,
    difficulty: diff, createdAt: Date.now()
  });

  document.getElementById('tqText').value = '';
  ['tqA', 'tqB', 'tqC', 'tqD'].forEach(id => { document.getElementById(id).value = ''; });

  save();
  renderTerritoryQuestions();
  publishTerritoryQuestions();
  toast(`已新增${DIFFICULTY[diff].label}題目`);
}

function deleteTerritoryQuestion(id) {
  state.territoryQuestions = state.territoryQuestions.filter(q => q.id !== id);
  save();
  renderTerritoryQuestions();
  publishTerritoryQuestions();
}

async function publishTerritoryQuestions() {
  if (!isCloudMode()) return;
  try {
    await Cloud.publishTerritoryQuestions(state.classId, state.territoryQuestions);
  } catch (e) {
    console.error('[領地戰] 題庫發布失敗:', e);
    toast('題庫同步失敗:' + e.message);
  }
}

function renderTerritoryQuestions() {
  const el = document.getElementById('tqList');
  if (!el) return;

  const qs = state.territoryQuestions;
  if (qs.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">◆</div><div>題庫是空的,先新增幾題</div></div>';
    return;
  }

  const byDiff = {};
  qs.forEach(q => { byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1; });

  el.innerHTML = `
    <div class="tq-summary">
      共 ${qs.length} 題 ·
      ${Object.entries(DIFFICULTY).map(([k, d]) =>
        `<span style="color:${d.color}">${d.label} ${byDiff[k] || 0}</span>`).join(' · ')}
    </div>` +
    qs.map(q => `
      <div class="tq-row">
        <span class="tq-diff" style="background:${DIFFICULTY[q.difficulty].color}">
          ${DIFFICULTY[q.difficulty].label} +${DIFFICULTY[q.difficulty].points}
        </span>
        <span class="tq-text">${escapeHtml(q.text)}</span>
        <span class="tq-answer">答:${'ABCD'[q.answer]}</span>
        <button class="btn btn-ghost btn-small" onclick="deleteTerritoryQuestion('${q.id}')">✕</button>
      </div>`).join('');
}

/* ---------- 開局 / 控制 ---------- */

async function startTerritoryGame() {
  if (!isCloudMode()) { toast('需要登入雲端才能進行領地戰'); return; }

  const groups = state.currentGroups && state.currentGroups.length
    ? state.currentGroups
    : (state.groupSets.length ? state.groupSets[state.groupSets.length - 1].groups : []);

  if (groups.length < 2) { toast('請先到「班級管理 → 隨機分組」分出至少兩組'); return; }
  if (state.territoryQuestions.length === 0) { toast('題庫是空的,先新增幾題'); return; }
  if (TerritoryGame.config && !confirm('目前有一局進行中,重新開始會清空現有戰況。確定嗎?')) return;

  const config = Territory.createConfig(groups, {
    radius: parseInt(document.getElementById('tgRadius').value) || 4,
    threshold: parseInt(document.getElementById('tgThreshold').value) || 5,
    battleSeconds: parseInt(document.getElementById('tgBattle').value) || 90,
    stageMode: document.getElementById('tgStageMode').value,
    stageSeconds: parseInt(document.getElementById('tgStageSeconds').value) || 300
  });

  try {
    await publishTerritoryQuestions();
    await Cloud.clearTerritoryEvents(state.classId);
    await Cloud.saveTerritoryConfig(state.classId, config);
    toast(`✦ 領地戰開始!${Hex.buildMap(config.radius).length} 格,${groups.length} 組`);
  } catch (e) {
    console.error(e);
    toast('開局失敗:' + e.message);
  }
}

async function endTerritoryGame() {
  if (!TerritoryGame.config) return;
  if (!confirm('確定結束這一局?')) return;
  await Cloud.saveTerritoryConfig(state.classId,
    { ...TerritoryGame.config, status: 'ended', endedAt: Date.now() });
  toast('領地戰已結束');
}

/* 手動模式下,老師按一次往中心多開一圈 */
async function openNextRing() {
  const c = TerritoryGame.config;
  if (!c) return;
  const depth = Math.min(c.radius + 1, (c.openDepth || 1) + 1);
  await Cloud.saveTerritoryConfig(state.classId, { ...c, openDepth: depth });
  toast(`已開放到第 ${depth} 層`);
}

/* ============================================
   監聽與重播
   ────────────────────────────────────────────
   老師端與學生端跑的是同一份重播,所以看到的地圖必然一致。
============================================ */

const TerritoryGame = {
  unsubConfig: null,
  unsubEvents: null,
  ticker: null,
  config: null,
  events: [],
  map: {},
  log: [],
  onUpdate: null,      // 學生端掛自己的重繪

  start(onUpdate) {
    this.stop();
    if (!isCloudMode()) return;
    this.onUpdate = onUpdate || null;

    this.unsubConfig = Cloud.watchTerritoryConfig(state.classId, c => {
      this.config = c;
      this.rebuild();
    });
    this.unsubEvents = Cloud.watchTerritoryEvents(state.classId, list => {
      this.events = list;
      this.rebuild();
    });

    // 戰役到期與階段開放都是「時間到了才發生」,沒有新事件也要重算
    this.ticker = setInterval(() => this.rebuild(), 1000);
  },

  stop() {
    if (this.unsubConfig) { this.unsubConfig(); this.unsubConfig = null; }
    if (this.unsubEvents) { this.unsubEvents(); this.unsubEvents = null; }
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
    this.config = null;
    this.events = [];
    this.map = {};
  },

  rebuild() {
    if (!this.config) { this.map = {}; return; }
    const r = Territory.replay(this.config, this.events);
    this.map = r.map;
    this.log = r.log;
    if (this.onUpdate) this.onUpdate();
    else renderTerritoryLive();
  },

  myTargets(groupIdx) {
    return Territory.targetsFor(this.config, this.map, groupIdx);
  }
};

/* 只更新地圖與戰況,不重繪整個頁面 —— 老師正在打字時不會被打斷 */
function renderTerritoryLive() {
  const board = document.getElementById('territoryBoard');
  if (!board || !board.offsetParent) return;
  renderTerritoryBoard();
  renderTerritoryFeed();
}

function renderTerritoryBoard() {
  const el = document.getElementById('territoryBoard');
  if (!el) return;

  if (!isCloudMode()) {
    el.innerHTML = '<div class="empty-state">需要登入雲端才能進行領地戰</div>';
    return;
  }
  const c = TerritoryGame.config;
  if (!c) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⬡</div><div>尚未開局。設定好上方選項後按「開始新的一局」</div></div>';
    return;
  }

  const nextAt = Territory.nextStageAt(c);
  const depth = Territory.openDepthAt(c, Date.now());

  el.innerHTML = `
    <div class="territory-status">
      <span class="territory-badge ${c.status}">${c.status === 'running' ? '進行中' : '已結束'}</span>
      <span>${Object.keys(TerritoryGame.map).length} 格 · 佔領門檻 ${c.threshold} 分 ·
            爭奪 ${c.battleSeconds} 秒</span>
      <span class="territory-stage">
        已開放 ${depth} 層${nextAt ? ` · 下一層 ${formatCountdown(nextAt - Date.now())}` : ' · 全部開放'}
      </span>
      <div style="flex:1"></div>
      ${c.stageMode === 'manual' && depth <= c.radius
        ? '<button class="btn btn-accent btn-small" onclick="openNextRing()">開放下一圈</button>' : ''}
      ${c.status === 'running'
        ? '<button class="btn btn-ghost btn-small" onclick="endTerritoryGame()">結束這一局</button>' : ''}
    </div>
    ${renderStandings(c, TerritoryGame.map)}
    ${renderHexMap(c, TerritoryGame.map, {})}`;
}

function renderTerritoryFeed() {
  const el = document.getElementById('territoryFeed');
  if (!el) return;

  const log = [...TerritoryGame.log].reverse().slice(0, 20);
  if (log.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:20px;">還沒有任何地塊易主</div>';
    return;
  }

  el.innerHTML = log.map(e => e.draw
    ? `<div class="feed-row void"><span class="feed-msg">${e.hexKey} 平手,無人佔領</span></div>`
    : `<div class="feed-row correct">
         <span class="feed-name" style="color:${GROUP_COLORS[e.to % GROUP_COLORS.length]}">
           第 ${e.to + 1} 組</span>
         <span class="feed-msg">以 ${e.points} 分拿下 ${e.hexKey}${
           e.from !== null ? `(原屬第 ${e.from + 1} 組)` : ''}</span>
       </div>`).join('');
}

function renderTerritoryView() {
  const activeSubtab = document.querySelector('#territoryView .sub-tab.active');
  const name = activeSubtab ? activeSubtab.dataset.subtab : 'tgBoard';
  if (name === 'tgBoard') { renderTerritoryBoard(); renderTerritoryFeed(); }
  if (name === 'tgQuestions') renderTerritoryQuestions();
}

/* 手動開放模式下,倒數秒數的欄位沒有意義 */
function toggleStageSeconds() {
  const auto = document.getElementById('tgStageMode').value === 'auto';
  document.getElementById('tgStageSeconds').style.display = auto ? '' : 'none';
  document.getElementById('tgStageUnit').style.display = auto ? '' : 'none';
}
