/* ============================================
   兌換商店
   ────────────────────────────────────────────
   老師上架獎品並訂價,學生用自己的可用積分兌換。

   為什麼扣點不在學生端做?
   學生沒有權限改班級資料,而且就算給了權限,前端的數字也擋不住
   有心人改。學生送出的只是一張「兌換申請」,實際的餘額檢查、扣點、
   扣庫存全部在老師端執行,這也是唯一有完整資料可以判斷的地方。

   積分是雙軌的:
   · 累積經驗 totalPoints — 只增不減,決定守護獸進化到哪一階
   · 可用積分 currentPoints — 兌換獎品時扣的就是這個
   學生每得一分,兩邊同時增加,所以兌換獎品不會讓守護獸退化。
============================================ */

/* 舊版內建商品。保留是為了讓先前的兌換紀錄仍查得到名稱,
   新的班級不會用到。 */
const LEGACY_SHOP_ITEMS = [
  { id: 'heal_fruit',   name: '療癒果實',     icon: '🍎', price: 8 },
  { id: 'energy_fruit', name: '元氣果實',     icon: '🍊', price: 15 },
  { id: 'growth_fruit', name: '成長果實',     icon: '🍓', price: 30 },
  { id: 'crown',        name: '黃金王冠',     icon: '👑', price: 50 },
  { id: 'scarf',        name: '溫暖圍巾',     icon: '🧣', price: 20 },
  { id: 'flower',       name: '山林花環',     icon: '🌸', price: 18 },
  { id: 'glasses',      name: '智慧之眼',     icon: '👓', price: 25 },
  { id: 'bowtie',       name: '紳士領結',     icon: '🎀', price: 22 },
  { id: 'star',         name: '榮耀之星',     icon: '⭐', price: 35 },
  { id: 'rename',       name: '靈獸命名卷軸', icon: '📜', price: 12 }
];

/* 舊程式碼(報表、AI 分析)還在用這個名字查商品 */
const SHOP_ITEMS = LEGACY_SHOP_ITEMS;

/* 新班級的建議起手式,老師可以直接改或刪掉 */
const STARTER_SHOP_ITEMS = [
  { name: '免寫一項作業', icon: '📝', price: 30, description: '任選一項當日作業免寫' },
  { name: '和老師吃午餐', icon: '🍱', price: 50, description: '和老師一起吃午餐聊天' },
  { name: '當一日小老師', icon: '🎓', price: 40, description: '協助老師帶領一節課的活動' },
  { name: '選座位優先權', icon: '💺', price: 60, description: '下次換座位時優先選擇' },
  { name: '小點心一份',   icon: '🍪', price: 20, description: '老師準備的小點心' },
  { name: '播放一首歌',   icon: '🎵', price: 25, description: '下課時間播放你點的歌' }
];

function findShopItem(itemId) {
  return (state.shopItems || []).find(i => i.id === itemId)
      || LEGACY_SHOP_ITEMS.find(i => i.id === itemId)
      || null;
}

/* ============================================
   獎品管理(老師端)
============================================ */

function addShopItem() {
  const name  = document.getElementById('shopItemName').value.trim();
  const icon  = document.getElementById('shopItemIcon').value.trim() || '🎁';
  const price = parseInt(document.getElementById('shopItemPrice').value);
  const stockRaw = document.getElementById('shopItemStock').value.trim();
  const desc  = document.getElementById('shopItemDesc').value.trim();

  if (!name) { toast('請輸入獎品名稱'); return; }
  if (isNaN(price) || price < 0) { toast('請輸入有效的點數'); return; }

  state.shopItems.unshift({
    id: 'item_' + Date.now(),
    name,
    icon,
    price,
    // 留空代表數量不限,例如「免寫作業」這種不會用完的獎勵
    stock: stockRaw === '' ? null : Math.max(0, parseInt(stockRaw) || 0),
    description: desc,
    active: true,
    createdAt: Date.now()
  });

  ['shopItemName', 'shopItemIcon', 'shopItemPrice', 'shopItemStock', 'shopItemDesc']
    .forEach(id => { document.getElementById(id).value = ''; });

  save();
  renderShopItems();
  toast(`已上架「${name}」`);
}

function loadStarterShopItems() {
  if (state.shopItems.length > 0 &&
      !confirm('這會在現有獎品之後加入 6 項範例,確定嗎?')) return;

  STARTER_SHOP_ITEMS.forEach((item, i) => {
    state.shopItems.push({
      id: 'item_' + Date.now() + '_' + i,
      ...item,
      stock: null,
      active: true,
      createdAt: Date.now()
    });
  });
  save();
  renderShopItems();
  toast('已加入 6 項範例獎品,可自行修改或刪除');
}

function updateShopItem(itemId, field, value) {
  const item = state.shopItems.find(i => i.id === itemId);
  if (!item) return;

  if (field === 'price') {
    const n = parseInt(value);
    if (isNaN(n) || n < 0) return;
    item.price = n;
  } else if (field === 'stock') {
    item.stock = value === '' ? null : Math.max(0, parseInt(value) || 0);
  } else {
    item[field] = value;
  }
  save();
}

function toggleShopItem(itemId) {
  const item = state.shopItems.find(i => i.id === itemId);
  if (!item) return;
  item.active = !item.active;
  save();
  renderShopItems();
  toast(item.active ? `「${item.name}」已上架` : `「${item.name}」已下架`);
}

function deleteShopItem(itemId) {
  const item = state.shopItems.find(i => i.id === itemId);
  if (!item) return;
  if (!confirm(`確定刪除「${item.name}」?已兌換的紀錄會保留。`)) return;
  state.shopItems = state.shopItems.filter(i => i.id !== itemId);
  save();
  renderShopItems();
}

function renderShopItems() {
  const el = document.getElementById('shopItemList');
  if (!el) return;

  if (state.shopItems.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🎁</div>
      <div>還沒有獎品。用上方表單新增,或
        <a href="#" onclick="loadStarterShopItems(); return false;">載入範例獎品</a>
      </div>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="shop-item-grid">` + state.shopItems.map(item => `
    <div class="shop-item-card ${item.active ? '' : 'inactive'}">
      <div class="shop-item-head">
        <input type="text" class="shop-item-icon-input" value="${escapeHtml(item.icon)}"
               maxlength="4" title="用一個 emoji 當圖示"
               onchange="updateShopItem('${item.id}','icon',this.value)" />
        <input type="text" class="shop-item-name-input" value="${escapeHtml(item.name)}"
               onchange="updateShopItem('${item.id}','name',this.value)" />
      </div>

      <input type="text" class="rule-editor-input" placeholder="說明(選填)"
             value="${escapeHtml(item.description || '')}"
             onchange="updateShopItem('${item.id}','description',this.value)" />

      <div class="shop-item-row">
        <label>點數</label>
        <input type="number" class="rule-editor-input" min="0" value="${item.price}"
               onchange="updateShopItem('${item.id}','price',this.value)" />
        <label>庫存</label>
        <input type="number" class="rule-editor-input" min="0" placeholder="不限"
               value="${item.stock === null ? '' : item.stock}"
               onchange="updateShopItem('${item.id}','stock',this.value)" />
      </div>

      <div class="shop-item-actions">
        <button class="btn btn-ghost btn-small" onclick="toggleShopItem('${item.id}')">
          ${item.active ? '下架' : '上架'}
        </button>
        <button class="btn btn-ghost btn-small" onclick="deleteShopItem('${item.id}')">刪除</button>
      </div>
    </div>`).join('') + `</div>`;
}

/* ============================================
   兌換申請的處理(老師端)
   ────────────────────────────────────────────
   學生一送出申請就自動結算,老師只需要負責實際把獎品給出去。
============================================ */

const PurchaseWatch = {
  unsub: null,
  all: [],
  processing: false,

  start() {
    this.stop();
    if (!isCloudMode()) return;
    this.unsub = Cloud.watchPurchases(state.classId, list => {
      this.all = list;
      this.process();
      renderPurchaseList();
      updatePurchaseBadge();
    });
  },

  stop() {
    if (this.unsub) { this.unsub(); this.unsub = null; }
    this.all = [];
  },

  /* 把還沒結算的申請一次處理完。
     同時只跑一輪,否則連續兩筆申請可能都讀到扣款前的餘額。 */
  async process() {
    if (this.processing) return;
    const pending = this.all.filter(p => p.status === 'pending');
    if (pending.length === 0) return;

    this.processing = true;
    try {
      // 依送出時間處理,先按的人先扣,庫存只剩一份時才公平
      pending.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      for (const p of pending) {
        const result = this.settle(p);
        try {
          await Cloud.updatePurchase(state.classId, p.id, result);
        } catch (e) {
          console.error('[Shop] 兌換結算寫回失敗:', e);
        }
      }
      save();
      renderAll();
    } finally {
      this.processing = false;
    }
  },

  /* 檢查並實際扣點。回傳要寫回申請單的狀態。 */
  settle(p) {
    const student = state.students.find(s => s.id === p.studentId);
    if (!student) {
      return { status: 'rejected', reason: '找不到這位學生' };
    }

    const item = findShopItem(p.itemId);
    if (!item) {
      return { status: 'rejected', reason: '這項獎品已被移除' };
    }
    if (!item.active) {
      return { status: 'rejected', reason: '這項獎品已下架' };
    }
    if (item.stock !== null && item.stock <= 0) {
      return { status: 'rejected', reason: '獎品已兌換完畢' };
    }
    // 以老師端的價格為準,不採用申請單上的 —— 學生送出後老師可能改價
    if (student.currentPoints < item.price) {
      return { status: 'rejected', reason: `可用積分不足(需要 ${item.price} 分)` };
    }

    student.currentPoints -= item.price;
    if (item.stock !== null) item.stock -= 1;

    if (!student.inventory) student.inventory = [];
    student.inventory.push(item.id);

    state.shopHistory.push({
      studentId: student.id,
      itemId: item.id,
      itemName: item.name,
      time: Date.now(),
      price: item.price
    });

    toast(`${student.name} 兌換了「${item.name}」`);
    return { status: 'paid', settledPrice: item.price, settledAt: Date.now() };
  },

  markDelivered(purchaseId) {
    Cloud.updatePurchase(state.classId, purchaseId, {
      status: 'delivered',
      deliveredAt: Date.now()
    }).catch(e => toast('更新失敗:' + e.message));
  },

  /* 退回已扣的點數。獎品發不出來時用。 */
  async refund(purchaseId) {
    const p = this.all.find(x => x.id === purchaseId);
    if (!p) return;
    const student = state.students.find(s => s.id === p.studentId);
    if (!student) return;
    if (!confirm(`確定退還「${p.itemName}」的 ${p.settledPrice} 點給 ${student.name}?`)) return;

    student.currentPoints += p.settledPrice || 0;
    const idx = student.inventory ? student.inventory.indexOf(p.itemId) : -1;
    if (idx >= 0) student.inventory.splice(idx, 1);

    const item = findShopItem(p.itemId);
    if (item && item.stock !== null) item.stock += 1;

    save();
    renderAll();
    await Cloud.updatePurchase(state.classId, purchaseId, {
      status: 'refunded', refundedAt: Date.now()
    });
    toast(`已退還 ${p.settledPrice} 點`);
  }
};

function updatePurchaseBadge() {
  const el = document.getElementById('purchaseBadge');
  if (!el) return;
  const n = PurchaseWatch.all.filter(p => p.status === 'paid').length;
  el.textContent = n > 0 ? n : '';
  el.style.display = n > 0 ? '' : 'none';
}

function renderPurchaseList() {
  const el = document.getElementById('purchaseList');
  if (!el) return;

  if (!isCloudMode()) {
    el.innerHTML = '<div class="empty-state">需要登入雲端,學生才能自行兌換</div>';
    return;
  }

  const waiting = PurchaseWatch.all.filter(p => p.status === 'paid')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const done = PurchaseWatch.all.filter(p => p.status !== 'paid' && p.status !== 'pending')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 30);

  const row = (p, isWaiting) => `
    <div class="purchase-row ${p.status}">
      <span class="purchase-icon">${escapeHtml(p.itemIcon || '🎁')}</span>
      <span class="purchase-main">
        <strong>${escapeHtml(p.studentName)}</strong> · ${escapeHtml(p.itemName)}
        <span class="purchase-meta">
          ${p.settledPrice != null ? p.settledPrice + ' 點' : ''}
          ${p.status === 'rejected' ? ' · 未成立:' + escapeHtml(p.reason || '') : ''}
          ${p.status === 'delivered' ? ' · 已發放' : ''}
          ${p.status === 'refunded' ? ' · 已退點' : ''}
        </span>
      </span>
      ${isWaiting ? `
        <button class="btn btn-primary btn-small"
                onclick="PurchaseWatch.markDelivered('${p.id}')">標記已發放</button>
        <button class="btn btn-ghost btn-small"
                onclick="PurchaseWatch.refund('${p.id}')">退點</button>` : ''}
    </div>`;

  el.innerHTML = `
    <div class="purchase-section-title">待發放 ${waiting.length > 0 ? `(${waiting.length})` : ''}</div>
    ${waiting.length > 0
      ? waiting.map(p => row(p, true)).join('')
      : '<div class="empty-state" style="padding:20px;">目前沒有待發放的獎品</div>'}

    ${done.length > 0 ? `
      <div class="purchase-section-title" style="margin-top:24px;">最近紀錄</div>
      ${done.map(p => row(p, false)).join('')}` : ''}
  `;
}

/* 進入商店分頁時的總渲染 */
function renderShopView() {
  const activeSubtab = document.querySelector('#shopView .sub-tab.active');
  const name = activeSubtab ? activeSubtab.dataset.subtab : 'shopItems';
  if (name === 'shopItems') renderShopItems();
  if (name === 'purchases') renderPurchaseList();
  if (name === 'tasks') renderTasksList();
}

/* 相容舊的呼叫點 */
function renderShop() { renderShopItems(); }
