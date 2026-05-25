/* ============================================
   守護獸商店
============================================ */
const SHOP_ITEMS = [
  // 食物 / 補給
  { id: 'heal_fruit', name: '療癒果實', icon: '🍎', category: 'food', price: 8, 
    description: '立即治癒生病或微恙的守護獸' },
  { id: 'energy_fruit', name: '元氣果實', icon: '🍊', category: 'food', price: 15, 
    description: '為守護獸補充元氣,7 天內不會生病' },
  { id: 'growth_fruit', name: '成長果實', icon: '🍓', category: 'food', price: 30, 
    description: '守護獸經驗值 +10(加速進化)' },
  
  // 配件 / 裝飾
  { id: 'crown', name: '黃金王冠', icon: '👑', category: 'accessory', price: 50, 
    description: '為守護獸戴上華麗的王冠' },
  { id: 'scarf', name: '溫暖圍巾', icon: '🧣', category: 'accessory', price: 20, 
    description: '溫暖可愛的條紋圍巾' },
  { id: 'flower', name: '山林花環', icon: '🌸', category: 'accessory', price: 18, 
    description: '台灣山野花朵編成的花環' },
  { id: 'glasses', name: '智慧之眼', icon: '👓', category: 'accessory', price: 25, 
    description: '看起來很有學問的眼鏡' },
  { id: 'bowtie', name: '紳士領結', icon: '🎀', category: 'accessory', price: 22, 
    description: '優雅的小領結' },
  { id: 'star', name: '榮耀之星', icon: '⭐', category: 'accessory', price: 35, 
    description: '閃耀的榮耀之星' },
  
  // 特殊
  { id: 'rename', name: '靈獸命名卷軸', icon: '📜', category: 'special', price: 12, 
    description: '為你的守護獸取一個專屬名字' },
  { id: 'unequip', name: '卸下配件', icon: '🧹', category: 'special', price: 0, 
    description: '免費卸下目前的配件(配件保留在背包)' }
];

let currentShopCategory = 'food';

function renderShop() {
  // 學生選單
  const picker = document.getElementById('shopStudentPicker');
  const currentVal = picker.value;
  picker.innerHTML = '<option value="">— 選擇學生 —</option>' + 
    state.students.map(s => {
      const icon = s.pet ? PetEngine.getIcon(s) : '❓';
      return `<option value="${s.id}" ${s.id === currentVal ? 'selected' : ''}>${s.name} (${s.currentPoints} 積分)</option>`;
    }).join('');
  
  onShopStudentChange();
}

function onShopStudentChange() {
  const id = document.getElementById('shopStudentPicker').value;
  const header = document.getElementById('shopHeader');
  const grid = document.getElementById('shopGrid');
  
  if (!id) {
    header.innerHTML = '<div class="empty-state" style="color: var(--moss); padding: 0;">請從上方下拉選單選擇一位學生開始購物</div>';
    grid.innerHTML = '';
    return;
  }
  
  const student = getStudent(id);
  if (!student) return;
  
  const icon = student.pet ? PetEngine.getIcon(student) : '❓';
  const species = student.pet ? PET_SPECIES.find(p => p.id === student.pet) : null;
  const stage = student.pet ? PetEngine.getStage(student.totalPoints) : 0;
  const accessoryIcon = student.equipped?.accessory 
    ? SHOP_ITEMS.find(i => i.id === student.equipped.accessory)?.icon || ''
    : '';
  
  header.innerHTML = `
    <div class="shop-customer">
      <div class="shop-customer-avatar" style="position:relative;">
        ${icon}
        ${accessoryIcon ? `<span class="pet-accessory">${accessoryIcon}</span>` : ''}
      </div>
      <div class="shop-customer-info">
        <div class="sci-name">${student.name}</div>
        <div class="sci-pet">${species ? species.name + ' · ' + STAGE_NAMES[stage] : '尚未選擇守護獸'}</div>
      </div>
    </div>
    <div class="shop-purse">
      <div class="shop-purse-label">可用積分</div>
      <div class="shop-purse-value">${student.currentPoints}</div>
    </div>
  `;
  
  renderShopGrid(student);
}

function setShopCategory(cat) {
  currentShopCategory = cat;
  document.querySelectorAll('.shop-cat-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === cat);
  });
  const id = document.getElementById('shopStudentPicker').value;
  if (id) renderShopGrid(getStudent(id));
}

function renderShopGrid(student) {
  const grid = document.getElementById('shopGrid');
  if (!student) {
    grid.innerHTML = '';
    return;
  }
  
  const items = SHOP_ITEMS.filter(i => i.category === currentShopCategory);
  
  grid.innerHTML = items.map(item => {
    const owned = student.inventory.includes(item.id);
    const equipped = student.equipped?.accessory === item.id;
    const affordable = student.currentPoints >= item.price;
    
    let actionBtn;
    if (item.id === 'unequip') {
      const hasAccessory = student.equipped?.accessory;
      actionBtn = `<button class="shop-item-action ${hasAccessory ? 'shop-action-buy' : 'shop-action-disabled'}" 
        ${hasAccessory ? `onclick="unequipAccessory('${student.id}')"` : 'disabled'}>
        ${hasAccessory ? '免費卸下' : '無已裝備配件'}
      </button>`;
    } else if (item.category === 'accessory') {
      if (equipped) {
        actionBtn = `<button class="shop-item-action shop-action-equipped">✓ 已佩戴</button>`;
      } else if (owned) {
        actionBtn = `<button class="shop-item-action shop-action-equip" onclick="equipAccessory('${student.id}', '${item.id}')">佩戴</button>`;
      } else {
        actionBtn = `<button class="shop-item-action ${affordable ? 'shop-action-buy' : 'shop-action-disabled'}" 
          ${affordable ? `onclick="buyShopItem('${student.id}', '${item.id}')"` : 'disabled'}>購買</button>`;
      }
    } else {
      // food / special - 可重複購買
      actionBtn = `<button class="shop-item-action ${affordable ? 'shop-action-buy' : 'shop-action-disabled'}" 
        ${affordable ? `onclick="buyShopItem('${student.id}', '${item.id}')"` : 'disabled'}>
        ${affordable ? '購買' : '積分不足'}
      </button>`;
    }
    
    return `
      <div class="shop-item ${affordable ? 'affordable' : 'unaffordable'} ${owned && item.category === 'accessory' ? 'owned' : ''}">
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.description}</div>
        <div class="shop-item-price">${item.price}</div>
        ${actionBtn}
      </div>
    `;
  }).join('');
}

function buyShopItem(studentId, itemId) {
  const student = getStudent(studentId);
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!student || !item) return;
  
  if (student.currentPoints < item.price) {
    toast('積分不足');
    return;
  }
  
  // 扣積分(僅 currentPoints)
  student.currentPoints -= item.price;
  
  // 記錄購買
  state.shopHistory.push({
    studentId, itemId, time: Date.now(), price: item.price
  });
  
  // 應用效果
  if (item.id === 'heal_fruit') {
    // 治癒:更新最後活動時間
    student.lastPointTime = Date.now();
    toast(`${student.name} 使用了療癒果實,守護獸康復了!`);
  } else if (item.id === 'energy_fruit') {
    student.shieldUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
    student.lastPointTime = Date.now();
    toast(`${student.name} 的守護獸獲得 7 天護盾!`);
  } else if (item.id === 'growth_fruit') {
    // 加經驗(影響 totalPoints,可能觸發進化)
    const oldStage = PetEngine.getStage(student.totalPoints);
    student.totalPoints += 10;
    student.lastPointTime = Date.now();
    student.history.push({ time: Date.now(), points: 10, reason: '成長果實(購買)' });
    const newStage = PetEngine.getStage(student.totalPoints);
    if (newStage > oldStage) {
      toast(`✦ ${student.name} 的守護獸進化為「${STAGE_NAMES[newStage]}」!`);
      logToContactBook('petLevelup', `${student.name} 的守護獸進化為「${STAGE_NAMES[newStage]}」(經由成長果實)`);
    } else {
      toast(`${student.name} 經驗 +10!`);
    }
  } else if (item.id === 'rename') {
    const newName = prompt('請為 ' + student.name + ' 的守護獸取名:');
    if (newName && newName.trim()) {
      student.petName = newName.trim();
      toast(`守護獸已命名為「${newName.trim()}」`);
    } else {
      // 取消命名,退錢
      student.currentPoints += item.price;
      state.shopHistory.pop();
      save();
      onShopStudentChange();
      return;
    }
  } else if (item.category === 'accessory') {
    student.inventory.push(item.id);
    // 第一件配件自動裝備
    if (!student.equipped.accessory) {
      student.equipped.accessory = item.id;
    }
    toast(`購買成功!${item.name} 已加入背包`);
  }
  
  // 自動更新班級任務進度
  updateClassTasksProgress();
  
  save();
  onShopStudentChange();
  renderStudentList();
  renderSelectedStudent();
  renderProjector();
}

function equipAccessory(studentId, itemId) {
  const student = getStudent(studentId);
  if (!student) return;
  student.equipped.accessory = itemId;
  save();
  onShopStudentChange();
  renderStudentList();
  renderSelectedStudent();
  renderProjector();
  toast('已更換配件');
}

function unequipAccessory(studentId) {
  const student = getStudent(studentId);
  if (!student) return;
  student.equipped.accessory = null;
  save();
  onShopStudentChange();
  renderStudentList();
  renderSelectedStudent();
  renderProjector();
}
