/* ============================================
   作業繳交
============================================ */
function createHomework() {
  const name = document.getElementById('hwName').value.trim();
  const desc = document.getElementById('hwDesc').value.trim();
  const due = document.getElementById('hwDueDate').value || getTodayDate();
  const points = parseInt(document.getElementById('hwPoints').value) || 2;
  
  if (!name) {
    toast('請輸入作業名稱');
    return;
  }
  
  state.homework.push({
    id: 'hw_' + Date.now(),
    name,
    description: desc,
    assignedDate: getTodayDate(),
    dueDate: due,
    submissionPoints: points,
    submissions: {},
    archived: false
  });
  
  save();
  document.getElementById('hwName').value = '';
  document.getElementById('hwDesc').value = '';
  document.getElementById('hwDueDate').value = '';
  renderHomeworkList();
  toast('已新增作業「' + name + '」');
}

function renderHomeworkList() {
  const list = document.getElementById('hwList');
  const active = state.homework.filter(h => !h.archived);
  const archived = state.homework.filter(h => h.archived);
  
  if (state.homework.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div>還沒有作業,從上方表單新增一筆</div>
      </div>
    `;
    return;
  }
  
  let html = '';
  active.forEach(hw => {
    html += renderHomeworkCard(hw, false);
  });
  
  if (archived.length > 0) {
    html += `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--paper-shadow); color: var(--ink-muted); font-size: 13px; font-weight: 600;">已封存(${archived.length})</div>`;
    archived.forEach(hw => {
      html += renderHomeworkCard(hw, true);
    });
  }
  
  list.innerHTML = html;
}

function renderHomeworkCard(hw, isArchived) {
  const subs = hw.submissions || {};
  let submitted = 0, late = 0, missing = 0;
  state.students.forEach(s => {
    const st = subs[s.id]?.status;
    if (st === 'submitted') submitted++;
    else if (st === 'late') late++;
    else if (st === 'missing') missing++;
  });
  const notMarked = state.students.length - submitted - late - missing;
  
  return `
    <div class="hw-card ${isArchived ? 'archived' : ''}">
      <div class="hw-card-header">
        <div class="hw-card-info">
          <div class="hw-card-title">${hw.name}</div>
          ${hw.description ? `<div class="hw-card-desc">${hw.description}</div>` : ''}
          <div class="hw-card-meta">
            <span>指定:${hw.assignedDate}</span>
            <span>繳交期限:${hw.dueDate}</span>
            <span>繳交可得 ${hw.submissionPoints} 分</span>
          </div>
        </div>
        <div class="hw-card-stats">
          <span class="hw-stat-pill green">繳 ${submitted}</span>
          <span class="hw-stat-pill yellow">遲 ${late}</span>
          <span class="hw-stat-pill red">缺 ${missing}</span>
          ${notMarked > 0 ? `<span class="hw-stat-pill">未批 ${notMarked}</span>` : ''}
        </div>
      </div>
      
      <div class="hw-submissions">
        <div class="hw-bulk-row">
          <button class="btn btn-primary btn-small" onclick="bulkMarkHomework('${hw.id}', 'submitted')">全部標記繳交</button>
          <button class="btn btn-ghost btn-small" onclick="bulkMarkHomework('${hw.id}', '')">清空標記</button>
          <div style="flex:1;"></div>
          ${isArchived ? 
            `<button class="btn btn-ghost btn-small" onclick="toggleHomeworkArchive('${hw.id}')">取消封存</button>` :
            `<button class="btn btn-ghost btn-small" onclick="toggleHomeworkArchive('${hw.id}')">封存</button>`
          }
          <button class="btn btn-ghost btn-small" onclick="deleteHomework('${hw.id}')" style="color: var(--sick);">刪除</button>
        </div>
        
        <div class="hw-student-grid">
          ${state.students.map(s => {
            const sub = subs[s.id];
            const status = sub?.status || '';
            const icon = s.pet ? PetEngine.getIcon(s) : '❓';
            return `
              <div class="hw-student-row ${status}">
                <div style="font-size:16px;">${icon}</div>
                <span class="hw-student-name">${s.name}</span>
                <div class="hw-student-buttons">
                  <button class="hw-mini-btn sub-yes ${status === 'submitted' ? 'active' : ''}" 
                    onclick="markHomework('${hw.id}', '${s.id}', 'submitted')" title="已繳交">✓</button>
                  <button class="hw-mini-btn sub-late ${status === 'late' ? 'active' : ''}" 
                    onclick="markHomework('${hw.id}', '${s.id}', 'late')" title="遲交">⏰</button>
                  <button class="hw-mini-btn sub-no ${status === 'missing' ? 'active' : ''}" 
                    onclick="markHomework('${hw.id}', '${s.id}', 'missing')" title="未繳">✕</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function markHomework(hwId, studentId, status) {
  const hw = state.homework.find(h => h.id === hwId);
  if (!hw) return;
  if (!hw.submissions) hw.submissions = {};
  
  const prev = hw.submissions[studentId];
  
  // 取消邏輯:再次點同樣狀態 = 清除
  if (prev && prev.status === status) {
    // 如果之前有加分,要扣回
    if (prev.awarded && prev.status === 'submitted') {
      const student = getStudent(studentId);
      if (student) {
        student.currentPoints = Math.max(0, student.currentPoints - hw.submissionPoints);
        // totalPoints 仍保留,寵物已得到的經驗不能拿走
      }
    }
    delete hw.submissions[studentId];
    save();
    renderHomeworkList();
    return;
  }
  
  // 設定新狀態
  hw.submissions[studentId] = {
    status,
    submittedAt: Date.now(),
    awarded: false
  };
  
  // 如果是繳交,自動加分(只加一次)
  if (status === 'submitted' && !prev?.awarded) {
    applyPointsToStudent(studentId, hw.submissionPoints, '繳交「' + hw.name + '」');
    hw.submissions[studentId].awarded = true;
  } else if (status === 'late' && !prev?.awarded) {
    // 遲交給一半分數(無條件捨去)
    const latePts = Math.floor(hw.submissionPoints / 2);
    if (latePts > 0) {
      applyPointsToStudent(studentId, latePts, '遲交「' + hw.name + '」');
    }
    hw.submissions[studentId].awarded = true;
  }
  
  save();
  renderHomeworkList();
}

function bulkMarkHomework(hwId, status) {
  const hw = state.homework.find(h => h.id === hwId);
  if (!hw) return;
  
  if (status === '') {
    if (!confirm('清空此作業的所有繳交標記?(已加分數會保留)')) return;
    hw.submissions = {};
  } else {
    state.students.forEach(s => {
      const prev = hw.submissions[s.id];
      if (!prev || prev.status !== status) {
        if (!hw.submissions[s.id]) hw.submissions[s.id] = {};
        hw.submissions[s.id].status = status;
        hw.submissions[s.id].submittedAt = Date.now();
        if (status === 'submitted' && !prev?.awarded) {
          applyPointsToStudent(s.id, hw.submissionPoints, '繳交「' + hw.name + '」');
          hw.submissions[s.id].awarded = true;
        }
      }
    });
  }
  
  save();
  renderHomeworkList();
  toast(status === '' ? '已清空' : '批次操作完成');
}

function toggleHomeworkArchive(hwId) {
  const hw = state.homework.find(h => h.id === hwId);
  if (!hw) return;
  hw.archived = !hw.archived;
  save();
  renderHomeworkList();
}

function deleteHomework(hwId) {
  if (!confirm('確定刪除此作業?(已發放的分數不會被取消)')) return;
  state.homework = state.homework.filter(h => h.id !== hwId);
  save();
  renderHomeworkList();
}
