/* ============================================
   渲染:選中學生
============================================ */
function selectStudent(id) {
  state.selectedStudentId = id;
  const student = getStudent(id);
  
  if (student && !student.pet) {
    openPetPicker(id);
    return;
  }
  
  renderStudentList();
  renderSelectedStudent();
}

function getStudent(id) {
  return state.students.find(s => s.id === id);
}

function renderSelectedStudent() {
  const display = document.getElementById('selectedStudentDisplay');
  const panel = document.getElementById('quickAssignPanel');
  
  if (!state.selectedStudentId) {
    display.innerHTML = `
      <div class="empty-state" style="color: var(--moss);">
        <div class="empty-state-icon">❋</div>
        <div>從左側選擇一位學生開始</div>
      </div>
    `;
    panel.style.display = 'none';
    return;
  }
  
  const student = getStudent(state.selectedStudentId);
  if (!student) return;
  
  const stage = student.pet ? PetEngine.getStage(student.totalPoints) : 0;
  const health = PetEngine.getHealth(student);
  const icon = student.pet ? PetEngine.getIcon(student) : '❓';
  const species = student.pet ? PET_SPECIES.find(p => p.id === student.pet) : null;
  const next = PetEngine.getNextStageInfo(student.totalPoints);
  const petLabel = student.petName ? `「${student.petName}」 · ` : '';
  
  display.innerHTML = `
    <div class="selected-display">
      <div class="selected-pet-large stage-${stage} health-${health}">
        ${icon}
      </div>
      <div class="selected-info">
        <div class="selected-name">${student.name}</div>
        <div class="selected-species">
          ${petLabel}${species ? species.name + ' · ' + STAGE_NAMES[stage] : '尚未選擇守護獸'}
          ${health === 'mild' ? ' · 微恙' : health === 'sick' ? ' · 生病了' : ''}

        </div>
        <div class="selected-stats">
          <div class="stat-block">
            <div class="stat-label">累積經驗</div>
            <div class="stat-value">${student.totalPoints}</div>
          </div>
          <div class="stat-block">
            <div class="stat-label">可用積分</div>
            <div class="stat-value" style="color: var(--gold);">${student.currentPoints}</div>
          </div>
          <div class="stat-block">
            <div class="stat-label">階段</div>
            <div class="stat-value">${stage + 1}<span style="font-size:14px;color:var(--moss);"> / 4</span></div>
          </div>
        </div>
        ${next.isMax ? `
          <div class="progress-text" style="color: var(--gold);">✦ 已達最高階段:守護神獸</div>
        ` : `
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${next.progress}%"></div>
          </div>
          <div class="progress-text">
            <span>距離「${STAGE_NAMES[next.nextStage]}」</span>
            <span>還差 ${next.neededInStage - next.currentInStage} 分</span>
          </div>
        `}
      </div>
    </div>
  `;
  
  panel.style.display = 'block';
}

/* ============================================
   渲染:積分規則按鈕
============================================ */
function renderRuleGrid() {
  const grid = document.getElementById('ruleGrid');
  grid.innerHTML = state.rules.map((rule, i) => `
    <button class="rule-card ${rule.points < 0 ? 'negative' : ''}" onclick="assignPoints(${i})">
      <div class="rule-card-name">${rule.name}</div>
      <div class="rule-card-points">${rule.points > 0 ? '+' : ''}${rule.points}</div>
    </button>
  `).join('');
}

/* ============================================
   發放積分
============================================ */
function assignPoints(ruleIndex) {
  if (!state.selectedStudentId) {
    toast('請先選擇一位學生');
    return;
  }
  const rule = state.rules[ruleIndex];
  applyPointsToStudent(state.selectedStudentId, rule.points, rule.name);
}

function assignCustomPoints() {
  if (!state.selectedStudentId) {
    toast('請先選擇一位學生');
    return;
  }
  const pointsInput = document.getElementById('customPoints');
  const reasonInput = document.getElementById('customReason');
  const points = parseInt(pointsInput.value);
  const reason = reasonInput.value.trim() || '自訂積分';
  
  if (isNaN(points) || points === 0) {
    toast('請輸入有效的分數');
    return;
  }
  
  applyPointsToStudent(state.selectedStudentId, points, reason);
  pointsInput.value = '';
  reasonInput.value = '';
}

function applyPointsToStudent(studentId, points, reason) {
  const student = getStudent(studentId);
  if (!student) return;
  
  const oldStage = student.pet ? PetEngine.getStage(student.totalPoints) : 0;
  
  // 正分:totalPoints 與 currentPoints 都加
  // 負分:只扣 currentPoints,totalPoints 不減(寵物不會退化)
  if (points >= 0) {
    student.totalPoints += points;
    student.currentPoints += points;
  } else {
    student.currentPoints = Math.max(0, student.currentPoints + points);
  }
  
  student.lastPointTime = Date.now();
  student.history.push({
    time: Date.now(),
    points: points,
    reason: reason
  });
  
  const newStage = student.pet ? PetEngine.getStage(student.totalPoints) : 0;
  
  // 更新班級任務進度
  updateClassTasksProgress();
  
  save();
  renderStudentList();
  renderSelectedStudent();
  renderProjector();
  
  if (newStage > oldStage) {
    toast(`✦ ${student.name} 的守護獸進化為「${STAGE_NAMES[newStage]}」!`);
    // 在今日聯絡簿留下記錄
    logToContactBook('petLevelup', `${student.name} 的守護獸進化為「${STAGE_NAMES[newStage]}」`);
  } else {
    toast(`${student.name} ${points > 0 ? '+' : ''}${points} 分 · ${reason}`);
  }
  
  triggerProjectorFlash(studentId, points);
}

/* ============================================
   寵物選擇器
============================================ */
function openPetPicker(studentId) {
  state.pendingPetSelection = studentId;
  state.pendingPetSpecies = null;
  
  const student = getStudent(studentId);
  document.getElementById('petPickerStudent').textContent = student.name;
  
  const grid = document.getElementById('petPickerGrid');
  grid.innerHTML = PET_SPECIES.map(pet => `
    <div class="pet-option" data-pet-id="${pet.id}" onclick="selectPetOption('${pet.id}')">
      <span class="pet-option-icon">${pet.icon}</span>
      <div class="pet-option-name">${pet.name}</div>
      <div class="pet-option-desc">${pet.desc}</div>
    </div>
  `).join('');
  
  document.getElementById('petPickerConfirm').disabled = true;
  document.getElementById('petPickerModal').classList.add('active');
}

function selectPetOption(petId) {
  state.pendingPetSpecies = petId;
  document.querySelectorAll('.pet-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.petId === petId);
  });
  document.getElementById('petPickerConfirm').disabled = false;
}

function confirmPetSelection() {
  if (!state.pendingPetSelection || !state.pendingPetSpecies) {
    toast('請先選擇一隻守護獸');
    return;
  }
  const student = getStudent(state.pendingPetSelection);
  student.pet = state.pendingPetSpecies;
  
  closeModal('petPickerModal');
  save();
  renderAll();
  state.selectedStudentId = student.id;
  renderSelectedStudent();
  
  const species = PET_SPECIES.find(p => p.id === student.pet);
  toast(`✦ ${student.name} 領養了「${species.name}」!`);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}
