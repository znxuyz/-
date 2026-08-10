/* ============================================
   寵物養成核心邏輯
============================================ */
const PetEngine = {
  // 計算寵物當前階段
  getStage(totalPoints) {
    for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalPoints >= STAGE_THRESHOLDS[i]) return i;
    }
    return 0;
  },
  
  // 計算下一階段所需積分
  getNextStageInfo(totalPoints) {
    const stage = this.getStage(totalPoints);
    if (stage >= STAGE_THRESHOLDS.length - 1) {
      return { isMax: true, current: totalPoints, needed: 0 };
    }
    const currentThreshold = STAGE_THRESHOLDS[stage];
    const nextThreshold = STAGE_THRESHOLDS[stage + 1];
    return {
      isMax: false,
      stage,
      nextStage: stage + 1,
      currentInStage: totalPoints - currentThreshold,
      neededInStage: nextThreshold - currentThreshold,
      progress: ((totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    };
  },
  
  // 計算健康狀態:基於最近被發分的天數
  getHealth(student) {
    // 護盾保護期(元氣果實)
    if (student.shieldUntil && student.shieldUntil > Date.now()) {
      return 'healthy';
    }
    if (!student.lastPointTime) return 'healthy';
    const daysSince = (Date.now() - student.lastPointTime) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) return 'sick';
    if (daysSince > 3) return 'mild';
    return 'healthy';
  },
  
  // 取得當前圖示。
  // assets/pets/ 有對應的 PNG 就用圖,沒有就退回 emoji。
  // 用 onerror 判斷而不是預先檢查檔案,因為前端無法同步得知檔案存不存在,
  // 這樣老師也可以一次只上傳幾張,沒上傳的維持 emoji。
  getIcon(student) {
    if (!student.pet) return '❓';
    const stage = this.getStage(student.totalPoints);
    const emoji = STAGE_ICONS[student.pet][stage];
    const src = `assets/pets/${student.pet}-${STAGE_KEYS[stage]}.png`;
    return `<img class="pet-img" src="${src}" alt="${emoji}" loading="lazy"
      onerror="this.outerHTML='<span class=&quot;pet-emoji&quot;>${emoji}</span>'">`;
  },

  // 純 emoji 版本,用於無法放圖片的場合(例如 alert、匯出的文字報表)
  getEmoji(student) {
    if (!student.pet) return '❓';
    return STAGE_ICONS[student.pet][this.getStage(student.totalPoints)];
  },
  
  // 取得配件圖示(若有裝備)
  getAccessoryIcon(student) {
    if (!student || !student.equipped || !student.equipped.accessory) return '';
    if (typeof SHOP_ITEMS === 'undefined') return '';
    const item = SHOP_ITEMS.find(i => i.id === student.equipped.accessory);
    return item ? item.icon : '';
  }
};

/* ============================================
   寵物渲染補強:支援配件顯示
============================================ */
function renderPetWithAccessory(student, iconStr) {
  if (!student || !student.equipped || !student.equipped.accessory) {
    return iconStr;
  }
  const accItem = SHOP_ITEMS.find(i => i.id === student.equipped.accessory);
  if (!accItem) return iconStr;
  return iconStr + `<span class="pet-accessory">${accItem.icon}</span>`;
}
