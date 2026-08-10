/* ============================================
   抽籤機
============================================ */
function renderPicker() {
  const history = state.pickerLastResult || [];
  const display = document.getElementById('pickerHistoryDisplay');
  
  if (history.length === 0) {
    display.innerHTML = '<span style="color: var(--ink-muted); font-size: 13px;">尚未抽過任何學生</span>';
    return;
  }
  
  display.innerHTML = history.map(id => {
    const s = getStudent(id);
    if (!s) return '';
    const icon = s.pet ? PetEngine.getIcon(s) : '❓';
    return `<span class="picker-history-chip">${icon} ${s.name}</span>`;
  }).join('');
}

function getEligibleStudents(mode) {
  let pool = [...state.students];
  
  if (mode === 'no-repeat') {
    const excluded = new Set(state.pickerHistory);
    pool = pool.filter(s => !excluded.has(s.id));
    if (pool.length === 0) {
      // 全部抽過,自動重置
      state.pickerHistory = [];
      toast('全班都抽過了,自動重置');
      pool = [...state.students];
    }
  } else if (mode === 'low-points') {
    // 加權:積分越低權重越高
    const maxPoints = Math.max(...pool.map(s => s.totalPoints), 1);
    pool = pool.flatMap(s => {
      const weight = Math.max(1, Math.ceil((maxPoints - s.totalPoints) / 5) + 1);
      return Array(weight).fill(s);
    });
  } else if (mode === 'sick-pets') {
    const sickPool = pool.filter(s => s.pet && PetEngine.getHealth(s) !== 'healthy');
    if (sickPool.length > 0) {
      pool = sickPool;
    } else {
      toast('沒有寵物生病的學生,改用一般模式');
    }
  }
  
  return pool;
}

function runPicker() {
  const count = parseInt(document.getElementById('pickerCount').value) || 1;
  const mode = document.getElementById('pickerMode').value;
  const btn = document.getElementById('pickerBtn');
  const display = document.getElementById('pickerDisplay');
  const petDisplay = document.getElementById('pickerPet');
  
  if (state.students.length === 0) {
    toast('沒有學生可以抽');
    return;
  }
  
  btn.disabled = true;
  display.classList.add('rolling');
  
  // 跑馬燈效果
  let rollCount = 0;
  const totalRolls = 18;
  const rollInterval = setInterval(() => {
    const randomStudent = state.students[Math.floor(Math.random() * state.students.length)];
    display.textContent = randomStudent.name;
    petDisplay.innerHTML = randomStudent.pet ? PetEngine.getIcon(randomStudent) : "✦";
    rollCount++;
    
    if (rollCount >= totalRolls) {
      clearInterval(rollInterval);
      
      // 真正抽出
      const pool = getEligibleStudents(mode);
      const picked = [];
      const tempPool = [...pool];
      
      for (let i = 0; i < count && tempPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * tempPool.length);
        const student = tempPool[idx];
        if (!picked.find(p => p.id === student.id)) {
          picked.push(student);
          // 從池中移除同一學生的所有實例(因為加權可能有重複)
          for (let j = tempPool.length - 1; j >= 0; j--) {
            if (tempPool[j].id === student.id) tempPool.splice(j, 1);
          }
        } else {
          tempPool.splice(idx, 1);
          i--;
        }
      }
      
      // 顯示結果
      if (picked.length === 1) {
        display.textContent = picked[0].name;
        petDisplay.innerHTML = picked[0].pet ? PetEngine.getIcon(picked[0]) : "✦";
      } else if (picked.length > 1) {
        display.textContent = picked.map(p => p.name).join('、');
        petDisplay.textContent = '✦';
      }
      
      display.classList.remove('rolling');
      btn.disabled = false;
      
      // 記錄
      state.pickerLastResult = picked.map(p => p.id);
      picked.forEach(p => {
        if (!state.pickerHistory.includes(p.id)) {
          state.pickerHistory.push(p.id);
        }
      });
      
      renderPicker();
    }
  }, 80);
}

function resetPicker() {
  state.pickerHistory = [];
  state.pickerLastResult = [];
  document.getElementById('pickerDisplay').textContent = '點下方按鈕開始';
  document.getElementById('pickerPet').textContent = '✦';
  renderPicker();
  toast('已重置抽籤紀錄');
}
