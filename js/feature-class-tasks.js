/* ============================================
   班級共同任務
============================================ */
function createTask() {
  const name = document.getElementById('taskName').value.trim();
  const reward = document.getElementById('taskReward').value.trim();
  const target = parseInt(document.getElementById('taskTarget').value);
  
  if (!name || !target || target < 1) {
    toast('請填寫任務名稱與目標分數');
    return;
  }
  
  state.classTasks.push({
    id: 'task_' + Date.now(),
    name,
    description: reward ? '獎勵:' + reward : '',
    target,
    reward,
    completed: false,
    completedAt: null,
    createdAt: Date.now()
  });
  
  save();
  document.getElementById('taskName').value = '';
  document.getElementById('taskReward').value = '';
  document.getElementById('taskTarget').value = '';
  renderTasksList();
  toast('已新增任務「' + name + '」');
}

function getClassTotalPoints() {
  return state.students.reduce((sum, s) => sum + s.totalPoints, 0);
}

function getTaskProgress(task) {
  if (task.type === 'legendCount') {
    let count = 0;
    state.students.forEach(s => {
      if (s.pet && PetEngine.getStage(s.totalPoints) === 3) count++;
    });
    return count;
  }
  // 預設:總積分
  return getClassTotalPoints();
}

function updateClassTasksProgress() {
  // 檢查每個任務是否達標(未自動完成,等老師手動標記)
  state.classTasks.forEach(task => {
    const progress = getTaskProgress(task);
    if (!task.completed && progress >= task.target) {
      // 不自動完成,但可顯示「達標可標記」
    }
  });
  // 不存檔(只有狀態變化)
}

function renderTasksList() {
  const list = document.getElementById('taskList');
  
  if (state.classTasks.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div>還沒有班級任務,從上方表單新增一個</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = state.classTasks.map(task => {
    const progress = getTaskProgress(task);
    const pct = Math.min(100, (progress / task.target) * 100);
    const isAchieved = progress >= task.target;
    const isCompleted = task.completed;
    const unit = task.type === 'legendCount' ? '位神獸' : '分';
    
    return `
      <div class="task-card ${isCompleted ? 'completed' : ''}">
        <div class="task-card-title">${task.name}</div>
        ${task.description ? `<div class="task-card-desc">${task.description}</div>` : ''}
        
        <div class="task-progress-wrap">
          <div class="task-progress-bar">
            <div class="task-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <div class="task-progress-text">
            <span><strong>${progress}</strong> / ${task.target} ${unit}</span>
            <span style="color: ${isAchieved ? 'var(--gold)' : 'var(--ink-muted)'};">${pct.toFixed(0)}%</span>
          </div>
        </div>
        
        ${task.reward ? `
          <div class="task-reward">
            <span class="task-reward-icon">🎁</span>
            <span>達標獎勵:${task.reward}</span>
          </div>
        ` : ''}
        
        ${isCompleted ? `
          <div class="task-reward" style="background: rgba(212, 164, 70, 0.15);">
            <span class="task-reward-icon">✦</span>
            <span>已於 ${new Date(task.completedAt).toLocaleDateString('zh-TW')} 達成</span>
          </div>
        ` : ''}
        
        <div class="task-card-actions">
          ${!isCompleted && isAchieved ? 
            `<button class="btn btn-accent btn-small" onclick="completeTask('${task.id}')">標記達成</button>` : ''}
          ${isCompleted ? 
            `<button class="btn btn-ghost btn-small" onclick="uncompleteTask('${task.id}')">取消達成</button>` : ''}
          <button class="btn btn-ghost btn-small" onclick="deleteTask('${task.id}')" style="color: var(--sick);">刪除</button>
        </div>
      </div>
    `;
  }).join('');
}

function completeTask(taskId) {
  const task = state.classTasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = true;
  task.completedAt = Date.now();
  save();
  renderTasksList();
  toast(`✦ 任務「${task.name}」已達成!`);
  logToContactBook('taskComplete', `班級任務「${task.name}」達成!獎勵:${task.reward || '無'}`);
}

function uncompleteTask(taskId) {
  const task = state.classTasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = false;
  task.completedAt = null;
  save();
  renderTasksList();
}

function deleteTask(taskId) {
  if (!confirm('確定刪除此任務?')) return;
  state.classTasks = state.classTasks.filter(t => t.id !== taskId);
  save();
  renderTasksList();
}
