/* ============================================
   領地佔領戰
   ────────────────────────────────────────────
   分組後才能玩。各組從自己的起始地塊出發,答對題目累積佔領分,
   達到門檻就拿下相鄰的地塊。搶別組的地要花兩倍的分。

   誰是裁判?
   和測驗一樣是老師端。學生只寫自己的作答單,批改、佔領分計算、
   地圖更新全部在老師的裝置上執行。這樣做有三個好處:
     · 題目的正確答案不會發到學生端
     · 兩組同時搶同一格時,由單一裁判依序處理,不會互相覆蓋
     · 老師隨時看得到誰在答什麼

   地圖存成一份文件裡的 map 欄位,鍵是 "q_r"。91 格也才幾十 KB,
   一次讀寫就更新完,學生端只要監聽一份文件。
============================================ */

/* ---------- 六角格座標 ----------
   用 axial 座標 (q, r),尖角朝上。
   六個鄰居的方向固定,不因奇偶列而變 —— 這是 axial 相對於
   offset 座標最大的好處,相鄰判斷不會寫錯。 */

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

  /* 產生一塊半徑 N 的六邊形地圖 */
  buildMap(radius) {
    const cells = [];
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      for (let r = r1; r <= r2; r++) cells.push(this.key(q, r));
    }
    return cells;
  },

  /* 轉成畫面座標。size 是外接圓半徑 */
  toPixel(q, r, size) {
    return {
      x: size * Math.sqrt(3) * (q + r / 2),
      y: size * 1.5 * r
    };
  },

  /* 六個頂點,尖角朝上 */
  corners(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 90);
      pts.push(`${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`);
    }
    return pts.join(' ');
  }
};

/* 各組的顏色。超過八組會循環使用,實務上不會發生 */
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
   遊戲狀態的建立與計算
============================================ */

const Territory = {
  DEFAULT_THRESHOLD: 5,      // 中立地塊所需的佔領分
  ENEMY_MULTIPLIER: 2,       // 搶別組的地要幾倍

  /* 建立新的一局。groups 是 id 陣列的陣列 */
  createGame(groups, radius, threshold) {
    const cells = Hex.buildMap(radius);
    const map = {};
    cells.forEach(k => { map[k] = { owner: null, cap: {} }; });

    // 起始地塊沿著最外圈平均分配,各組離得夠遠才有推進的空間
    const starts = this.pickStarts(cells, groups.length, radius);
    starts.forEach((key, i) => {
      if (map[key]) map[key] = { owner: i, cap: {}, isBase: true };
    });

    return {
      radius,
      threshold: threshold || this.DEFAULT_THRESHOLD,
      groupCount: groups.length,
      map,
      status: 'running',
      startedAt: Date.now()
    };
  },

  /* 在最外圈上等距取點當各組的起點 */
  pickStarts(cells, groupCount, radius) {
    const ring = cells.filter(k => {
      const { q, r } = Hex.parse(k);
      return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) === radius;
    });
    // 依角度排序,才能真的「等距」分佈,而不是照產生順序
    ring.sort((a, b) => {
      const pa = Hex.parse(a), pb = Hex.parse(b);
      const A = Hex.toPixel(pa.q, pa.r, 1), B = Hex.toPixel(pb.q, pb.r, 1);
      return Math.atan2(A.y, A.x) - Math.atan2(B.y, B.x);
    });

    const step = ring.length / groupCount;
    return Array.from({ length: groupCount }, (_, i) => ring[Math.floor(i * step)]);
  },

  /* 這一組現在可以攻打哪些地塊 —— 和自己領地相鄰,且不是自己的 */
  targetsFor(game, groupIdx) {
    const mine = Object.keys(game.map).filter(k => game.map[k].owner === groupIdx);
    const targets = new Set();
    mine.forEach(k => {
      const { q, r } = Hex.parse(k);
      Hex.neighbors(q, r).forEach(n => {
        if (game.map[n] && game.map[n].owner !== groupIdx) targets.add(n);
      });
    });
    return targets;
  },

  /* 拿下這一格需要多少佔領分 */
  requiredFor(game, hexKey) {
    const cell = game.map[hexKey];
    if (!cell) return Infinity;
    return cell.owner === null
      ? game.threshold
      : game.threshold * this.ENEMY_MULTIPLIER;
  },

  /* 加上佔領分,必要時易主。回傳這次發生了什麼。 */
  applyCapture(game, hexKey, groupIdx, points) {
    const cell = game.map[hexKey];
    if (!cell) return { ok: false, reason: '地塊不存在' };
    if (cell.owner === groupIdx) return { ok: false, reason: '這已經是你們的地了' };
    if (cell.isBase) return { ok: false, reason: '起始基地無法被攻佔' };

    const key = String(groupIdx);
    cell.cap[key] = (cell.cap[key] || 0) + points;

    const required = this.requiredFor(game, hexKey);
    if (cell.cap[key] >= required) {
      const previousOwner = cell.owner;
      cell.owner = groupIdx;
      cell.cap = {};        // 易主後歸零,別組累積的努力也一併清掉
      return { ok: true, captured: true, gained: points, previousOwner, required };
    }

    return {
      ok: true,
      captured: false,
      gained: points,
      progress: cell.cap[key],
      required
    };
  },

  /* 各組目前佔了幾格 */
  standings(game) {
    const counts = Array.from({ length: game.groupCount }, () => 0);
    Object.values(game.map).forEach(c => {
      if (c.owner !== null && counts[c.owner] !== undefined) counts[c.owner]++;
    });
    return counts
      .map((count, groupIdx) => ({ groupIdx, count }))
      .sort((a, b) => b.count - a.count);
  },

  totalCells(game) {
    return Object.keys(game.map).length;
  }
};

/* ============================================
   地圖繪製(老師端與學生端共用)
============================================ */

function renderHexMap(game, opts) {
  const o = opts || {};
  const size = 26;
  const cells = Object.keys(game.map);

  // 先算出所有格子的座標,再據此決定畫布範圍,地圖才會剛好置中
  const positions = {};
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  cells.forEach(k => {
    const { q, r } = Hex.parse(k);
    const p = Hex.toPixel(q, r, size);
    positions[k] = p;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });

  const pad = size * 1.4;
  const vb = [minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2];

  const targets = o.groupIdx != null ? Territory.targetsFor(game, o.groupIdx) : new Set();

  const polys = cells.map(k => {
    const cell = game.map[k];
    const p = positions[k];
    const owned = cell.owner !== null;
    const fill = owned ? GROUP_COLORS[cell.owner % GROUP_COLORS.length] : '#e8e2d4';
    const canAttack = targets.has(k);

    // 進攻方已累積的佔領分,用格子下方的小長條表示
    const myCap = o.groupIdx != null ? (cell.cap[String(o.groupIdx)] || 0) : 0;
    const required = Territory.requiredFor(game, k);
    const progress = myCap > 0 ? Math.min(1, myCap / required) : 0;

    return `
      <g class="hex ${canAttack ? 'attackable' : ''} ${cell.isBase ? 'base' : ''}"
         ${canAttack && o.onClick ? `onclick="${o.onClick}('${k}')"` : ''}>
        <polygon points="${Hex.corners(p.x, p.y, size)}"
                 fill="${fill}" stroke="#faf7f0" stroke-width="2"
                 opacity="${owned ? 0.9 : 0.55}" />
        ${cell.isBase ? `<text x="${p.x}" y="${p.y + 5}" class="hex-base-mark">★</text>` : ''}
        ${progress > 0 ? `
          <rect x="${p.x - size * 0.6}" y="${p.y + size * 0.45}"
                width="${size * 1.2}" height="4" rx="2" fill="rgba(0,0,0,0.15)" />
          <rect x="${p.x - size * 0.6}" y="${p.y + size * 0.45}"
                width="${(size * 1.2 * progress).toFixed(1)}" height="4" rx="2"
                fill="${GROUP_COLORS[o.groupIdx % GROUP_COLORS.length]}" />` : ''}
      </g>`;
  }).join('');

  return `<svg class="hex-map" viewBox="${vb.join(' ')}"
               preserveAspectRatio="xMidYMid meet">${polys}</svg>`;
}

/* 各組佔領數的長條 */
function renderStandings(game, highlightGroup) {
  const total = Territory.totalCells(game);
  return `<div class="territory-standings">` +
    Territory.standings(game).map(s => {
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

/* ============================================
   老師端:題庫、開局、當裁判
============================================ */

function createTerritoryQuestion() {
  const text = document.getElementById('tqText').value.trim();
  const diff = document.getElementById('tqDifficulty').value;
  const opts = ['tqA', 'tqB', 'tqC', 'tqD'].map(id => document.getElementById(id).value.trim());
  const answer = parseInt(document.querySelector('input[name="tqAnswer"]:checked')?.value ?? '0');

  if (!text) { toast('請輸入題目'); return; }
  if (opts.filter(Boolean).length < 2) { toast('至少要有兩個選項'); return; }
  if (!opts[answer]) { toast('正確答案那一格是空的'); return; }

  state.territoryQuestions.unshift({
    id: 'tq_' + Date.now(),
    text, options: opts, answer, difficulty: diff,
    createdAt: Date.now()
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

function renderTerritoryQuestions() {
  const el = document.getElementById('tqList');
  if (!el) return;

  const byDiff = { easy: 0, medium: 0, hard: 0 };
  state.territoryQuestions.forEach(q => { byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1; });

  if (state.territoryQuestions.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">◆</div><div>題庫是空的,先新增幾題</div></div>';
    return;
  }

  el.innerHTML = `
    <div class="tq-summary">
      共 ${state.territoryQuestions.length} 題 ·
      ${Object.entries(DIFFICULTY).map(([k, d]) =>
        `<span style="color:${d.color}">${d.label} ${byDiff[k] || 0}</span>`).join(' · ')}
    </div>` +
    state.territoryQuestions.map(q => `
      <div class="tq-row">
        <span class="tq-diff" style="background:${DIFFICULTY[q.difficulty].color}">
          ${DIFFICULTY[q.difficulty].label} +${DIFFICULTY[q.difficulty].points}
        </span>
        <span class="tq-text">${escapeHtml(q.text)}</span>
        <span class="tq-answer">答:${'ABCD'[q.answer]}</span>
        <button class="btn btn-ghost btn-small" onclick="deleteTerritoryQuestion('${q.id}')">✕</button>
      </div>`).join('');
}

/* 發布給學生的題目要抽掉正確答案 */
async function publishTerritoryQuestions() {
  if (!isCloudMode()) return;
  try {
    await Cloud.publishTerritoryQuestions(state.classId,
      state.territoryQuestions.map(q => ({
        id: q.id, text: q.text, options: q.options, difficulty: q.difficulty
      })));
  } catch (e) {
    console.error('[領地戰] 題庫發布失敗:', e);
  }
}

/* ---------- 開始 / 結束 ---------- */

async function startTerritoryGame() {
  if (!isCloudMode()) { toast('需要登入雲端才能進行領地戰'); return; }

  const groups = state.currentGroups && state.currentGroups.length
    ? state.currentGroups
    : (state.groupSets.length ? state.groupSets[state.groupSets.length - 1].groups : []);

  if (groups.length < 2) {
    toast('請先到「班級管理 → 隨機分組」分出至少兩組');
    return;
  }
  if (state.territoryQuestions.length === 0) {
    toast('題庫是空的,先新增幾題');
    return;
  }
  if (TerritoryGame.game && !confirm('目前有一局進行中,要重新開始嗎?現有戰況會消失。')) return;

  const radius = parseInt(document.getElementById('tgRadius').value) || 4;
  const threshold = parseInt(document.getElementById('tgThreshold').value) || 5;

  const game = Territory.createGame(groups, radius, threshold);
  // 記下每位學生屬於哪一組,學生端才知道自己能打哪裡
  game.memberGroup = {};
  groups.forEach((members, i) => {
    (members || []).forEach(m => {
      const id = Leaderboard.memberId(m);
      if (id) game.memberGroup[id] = i;
    });
  });

  try {
    await publishTerritoryQuestions();
    await Cloud.saveTerritoryGame(state.classId, game);
    toast(`✦ 領地戰開始!${Territory.totalCells(game)} 格地圖,${groups.length} 組競爭`);
  } catch (e) {
    console.error(e);
    toast('開局失敗:' + e.message);
  }
}

async function endTerritoryGame() {
  if (!TerritoryGame.game) return;
  if (!confirm('確定結束這一局?')) return;
  const g = { ...TerritoryGame.game, status: 'ended', endedAt: Date.now() };
  await Cloud.saveTerritoryGame(state.classId, g);
  toast('領地戰已結束');
}

/* ---------- 裁判 ----------
   學生的作答一進來就批改、算佔領分、更新地圖。
   一次只處理一輪,兩組同時搶同一格時才不會互相覆蓋。 */

const TerritoryGame = {
  unsubGame: null,
  unsubAttempts: null,
  game: null,
  attempts: [],
  judging: false,

  start() {
    this.stop();
    if (!isCloudMode()) return;

    this.unsubGame = Cloud.watchTerritoryGame(state.classId, g => {
      this.game = g;
      renderTerritoryBoard();
    });

    this.unsubAttempts = Cloud.watchTerritoryAttempts(state.classId, list => {
      this.attempts = list;
      this.judge();
      renderTerritoryFeed();
    });
  },

  stop() {
    if (this.unsubGame) { this.unsubGame(); this.unsubGame = null; }
    if (this.unsubAttempts) { this.unsubAttempts(); this.unsubAttempts = null; }
    this.game = null;
    this.attempts = [];
  },

  async judge() {
    if (this.judging || !this.game || this.game.status !== 'running') return;
    const pending = this.attempts.filter(a => a.status === 'pending');
    if (pending.length === 0) return;

    this.judging = true;
    try {
      // 依送出時間處理,先答的人先算,同一格的爭奪才公平
      pending.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      let changed = false;
      for (const a of pending) {
        const verdict = this.judgeOne(a);
        if (verdict.mapChanged) changed = true;
        try {
          await Cloud.updateTerritoryAttempt(state.classId, a.id, verdict.result);
        } catch (e) {
          console.error('[領地戰] 判定寫回失敗:', e);
        }
      }
      if (changed) await Cloud.saveTerritoryGame(state.classId, this.game);
    } finally {
      this.judging = false;
    }
  },

  judgeOne(a) {
    const q = state.territoryQuestions.find(x => x.id === a.questionId);
    if (!q) {
      return { mapChanged: false, result: { status: 'void', message: '題目已被刪除' } };
    }

    const groupIdx = this.game.memberGroup ? this.game.memberGroup[a.studentId] : null;
    if (groupIdx == null) {
      return { mapChanged: false, result: { status: 'void', message: '你不在任何一組' } };
    }

    // 答錯就只是答錯,地圖不動
    if (Number(a.answer) !== Number(q.answer)) {
      return {
        mapChanged: false,
        result: { status: 'wrong', message: '答錯了,再試一次', judgedAt: Date.now() }
      };
    }

    // 相鄰檢查要在判定當下重做 —— 學生點下去到送出之間,
    // 那一格可能已經被別組拿走了
    if (!Territory.targetsFor(this.game, groupIdx).has(a.hexKey)) {
      return {
        mapChanged: false,
        result: { status: 'void', message: '這格已經不能攻打了(可能剛被搶走)', judgedAt: Date.now() }
      };
    }

    const points = DIFFICULTY[q.difficulty].points;
    const r = Territory.applyCapture(this.game, a.hexKey, groupIdx, points);
    if (!r.ok) {
      return { mapChanged: false, result: { status: 'void', message: r.reason, judgedAt: Date.now() } };
    }

    if (r.captured) {
      toast(`第 ${groupIdx + 1} 組拿下了一塊地!`);
    }

    return {
      mapChanged: true,
      result: {
        status: 'correct',
        captured: !!r.captured,
        gained: points,
        progress: r.progress || 0,
        required: r.required,
        message: r.captured ? '★ 佔領成功!' : `答對!佔領分 ${r.progress}/${r.required}`,
        judgedAt: Date.now()
      }
    };
  }
};

/* ---------- 老師端畫面 ---------- */

function renderTerritoryBoard() {
  const el = document.getElementById('territoryBoard');
  if (!el) return;

  if (!isCloudMode()) {
    el.innerHTML = '<div class="empty-state">需要登入雲端才能進行領地戰</div>';
    return;
  }
  if (!TerritoryGame.game) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⬡</div><div>尚未開局。設定好上方選項後按「開始新的一局」</div></div>';
    return;
  }

  const g = TerritoryGame.game;
  el.innerHTML = `
    <div class="territory-status">
      <span class="territory-badge ${g.status}">${g.status === 'running' ? '進行中' : '已結束'}</span>
      <span>${Territory.totalCells(g)} 格 · 中立 ${g.threshold} 分 · 敵方 ${g.threshold * Territory.ENEMY_MULTIPLIER} 分</span>
      <div style="flex:1"></div>
      ${g.status === 'running'
        ? '<button class="btn btn-ghost btn-small" onclick="endTerritoryGame()">結束這一局</button>' : ''}
    </div>
    ${renderStandings(g)}
    ${renderHexMap(g, {})}`;
}

function renderTerritoryFeed() {
  const el = document.getElementById('territoryFeed');
  if (!el) return;

  const recent = TerritoryGame.attempts
    .filter(a => a.status !== 'pending')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 20);

  if (recent.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:20px;">還沒有人作答</div>';
    return;
  }

  el.innerHTML = recent.map(a => `
    <div class="feed-row ${a.status}">
      <span class="feed-name">${escapeHtml(a.studentName)}</span>
      <span class="feed-msg">${escapeHtml(a.message || '')}</span>
    </div>`).join('');
}

function renderTerritoryView() {
  const activeSubtab = document.querySelector('#territoryView .sub-tab.active');
  const name = activeSubtab ? activeSubtab.dataset.subtab : 'tgBoard';
  if (name === 'tgBoard') { renderTerritoryBoard(); renderTerritoryFeed(); }
  if (name === 'tgQuestions') renderTerritoryQuestions();
}
