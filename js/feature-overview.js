/* ============================================
   班級總覽
============================================ */
function renderOverview() {
  const statsGrid = document.getElementById('statsGrid');
  
  const total = state.students.reduce((s, st) => s + st.totalPoints, 0);
  const avg = state.students.length ? Math.round(total / state.students.length) : 0;
  const stageCount = [0, 0, 0, 0];
  let sickCount = 0;
  let unselectedCount = 0;
  
  state.students.forEach(s => {
    if (!s.pet) { unselectedCount++; return; }
    const stage = PetEngine.getStage(s.totalPoints);
    stageCount[stage]++;
    const health = PetEngine.getHealth(s);
    if (health !== 'healthy') sickCount++;
  });
  
  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">班級總積分</div>
      <div class="stat-card-value">${total}</div>
      <div class="stat-card-detail">平均 ${avg} 分/人</div>
    </div>
    <div class="stat-card accent">
      <div class="stat-card-label">守護神獸</div>
      <div class="stat-card-value">${stageCount[3]}</div>
      <div class="stat-card-detail">已成神的學生</div>
    </div>
    <div class="stat-card gold">
      <div class="stat-card-label">成獸數量</div>
      <div class="stat-card-value">${stageCount[2]}</div>
      <div class="stat-card-detail">即將成神</div>
    </div>
    <div class="stat-card plum">
      <div class="stat-card-label">需要關心</div>
      <div class="stat-card-value">${sickCount}</div>
      <div class="stat-card-detail">寵物生病或微恙</div>
    </div>
  `;
  
  // 階段分布
  const distEl = document.getElementById('stageDistribution');
  const total2 = state.students.filter(s => s.pet).length || 1;
  distEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${STAGE_NAMES.map((name, i) => {
        const count = stageCount[i];
        const pct = (count / total2) * 100;
        const color = i === 3 ? 'var(--gold)' : i === 2 ? 'var(--sunset)' : i === 1 ? 'var(--forest-light)' : 'var(--moss)';
        return `
          <div>
            <div class="flex-between" style="margin-bottom: 6px; font-size: 13px;">
              <span><strong>${name}</strong></span>
              <span class="text-muted">${count} 位 · ${pct.toFixed(0)}%</span>
            </div>
            <div style="height: 10px; background: var(--paper-shadow); border-radius: 5px; overflow: hidden;">
              <div style="height: 100%; width: ${pct}%; background: ${color}; transition: width 0.6s;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // 需要關心的學生
  const attentionEl = document.getElementById('needsAttention');
  const needsHelp = state.students
    .filter(s => s.pet && PetEngine.getHealth(s) !== 'healthy')
    .sort((a, b) => (a.lastPointTime || 0) - (b.lastPointTime || 0));
  
  if (needsHelp.length === 0) {
    attentionEl.innerHTML = `
      <div class="empty-state" style="padding: 30px;">
        <div class="empty-state-icon">✦</div>
        <div>全班守護獸都很健康!</div>
      </div>
    `;
  } else {
    attentionEl.innerHTML = needsHelp.map(s => {
      const health = PetEngine.getHealth(s);
      const days = s.lastPointTime ? Math.floor((Date.now() - s.lastPointTime) / (1000 * 60 * 60 * 24)) : '∞';
      return `
        <div class="flex-between" style="padding: 12px; background: var(--paper); border-radius: 6px; margin-bottom: 8px;">
          <div class="flex-row">
            <div class="student-avatar health-${health}" style="width: 36px; height: 36px; font-size: 18px;">
              ${PetEngine.getIcon(s)}
            </div>
            <div>
              <div style="font-weight: 600;">${s.name}</div>
              <div style="font-size: 12px; color: var(--ink-muted);">
                ${health === 'sick' ? '生病了' : '微恙中'} · 已 ${days} 天未獲得積分
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-small" onclick="state.selectedStudentId='${s.id}'; switchView('dashboard'); renderAll();">
            前往關心
          </button>
        </div>
      `;
    }).join('');
  }
}
