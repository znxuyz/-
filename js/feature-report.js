/* ============================================
   學期成長報表
============================================ */
function renderReportStudentList() {
  const list = document.getElementById('reportStudentList');
  if (!list) return;
  
  if (state.students.length === 0) {
    list.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">尚無學生</div>';
    return;
  }
  
  list.innerHTML = state.students.map(s => {
    const stage = s.pet ? PetEngine.getStage(s.totalPoints) : 0;
    const icon = s.pet ? PetEngine.getIcon(s) : '❓';
    return `
      <div class="report-student-card" onclick="showStudentReport('${s.id}')">
        <div class="student-avatar stage-${stage}" style="width:40px;height:40px;font-size:20px;">
          ${icon}
        </div>
        <div class="info">
          <div class="nm">${s.name}</div>
          <div class="meta">${STAGE_NAMES[stage]} · ${s.totalPoints} 經驗</div>
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('reportContainer').innerHTML = '';
}

function showStudentReport(studentId) {
  const container = document.getElementById('reportContainer');
  const student = getStudent(studentId);
  if (!student) return;
  
  const report = buildStudentReport(student);
  container.innerHTML = report;
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildStudentReport(s) {
  const stage = s.pet ? PetEngine.getStage(s.totalPoints) : 0;
  const species = s.pet ? PET_SPECIES.find(p => p.id === s.pet) : null;
  const icon = s.pet ? PetEngine.getIcon(s) : '❓';
  
  // 統計總出席
  let presentDays = 0, absentDays = 0, lateDays = 0, totalDays = 0;
  Object.values(state.attendance).forEach(day => {
    if (day[s.id]) {
      totalDays++;
      if (day[s.id] === 'present') presentDays++;
      else if (day[s.id] === 'absent') absentDays++;
      else if (day[s.id] === 'late') lateDays++;
    }
  });
  const attendanceRate = totalDays > 0 ? Math.round((presentDays + lateDays) / totalDays * 100) : 0;
  
  // 作業
  let hwSubmitted = 0, hwLate = 0, hwMissing = 0, hwTotal = 0;
  state.homework.forEach(hw => {
    hwTotal++;
    const sub = hw.submissions?.[s.id];
    if (sub) {
      if (sub.status === 'submitted') hwSubmitted++;
      else if (sub.status === 'late') hwLate++;
      else if (sub.status === 'missing') hwMissing++;
    } else {
      hwMissing++;
    }
  });
  const hwRate = hwTotal > 0 ? Math.round((hwSubmitted + hwLate) / hwTotal * 100) : 100;
  
  // 積分來源分類
  const reasonGroups = {};
  (s.history || []).forEach(h => {
    if (!reasonGroups[h.reason]) reasonGroups[h.reason] = 0;
    reasonGroups[h.reason] += h.points;
  });
  const topReasons = Object.entries(reasonGroups).sort((a,b) => b[1] - a[1]).slice(0, 5);
  
  // 週累積積分(取最近 8 週)
  const weeklyPoints = computeWeeklyPoints(s);
  const maxWeek = Math.max(...weeklyPoints.map(w => Math.abs(w.points)), 1);
  
  // 商店購買
  const purchases = state.shopHistory.filter(h => h.studentId === s.id);
  const itemCounts = {};
  purchases.forEach(p => {
    const item = findShopItem(p.itemId);
    if (item) itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
  });
  
  return `
    <div class="report-page" id="reportPrintArea">
      <h1>${state.className} · 學期成長報告</h1>
      <div class="report-meta">${s.name} · ${state.teacherName} · 截至 ${formatChineseDate(getTodayDate())}</div>
      
      <div class="report-hero">
        <div class="report-hero-pet">
          ${icon}
        </div>
        <div class="report-hero-info">
          <div class="name">${s.name}</div>
          <div class="desc">守護獸 ${species ? species.name : '尚未選擇'}${s.petName ? '「' + s.petName + '」' : ''} · 已成長至「<strong>${STAGE_NAMES[stage]}</strong>」階段</div>
          <div class="report-stats">
            <div class="report-stat"><span class="label">累積經驗</span><span class="val">${s.totalPoints}</span></div>
            <div class="report-stat"><span class="label">可用積分</span><span class="val">${s.currentPoints}</span></div>
            <div class="report-stat"><span class="label">出席率</span><span class="val">${attendanceRate}%</span></div>
            <div class="report-stat"><span class="label">作業完成率</span><span class="val">${hwRate}%</span></div>
          </div>
        </div>
      </div>
      
      <h2>成長軌跡(週累積積分)</h2>
      <div class="report-chart-wrap">
        <div class="report-bar-chart">
          ${weeklyPoints.map(w => `
            <div class="report-bar" 
              style="height: ${Math.max(3, (Math.abs(w.points) / maxWeek * 100))}%; ${w.points < 0 ? 'background: linear-gradient(180deg, #B5563D, #8B3A4E);' : ''}"
              data-value="${w.label}: ${w.points > 0 ? '+' : ''}${w.points} 分"></div>
          `).join('')}
        </div>
        <div class="report-chart-labels">
          ${weeklyPoints.map(w => `<span>${w.label}</span>`).join('')}
        </div>
      </div>
      
      <h2>積分來源分布</h2>
      <div class="report-breakdown">
        <div class="report-breakdown-block">
          <h3>主要得分項目</h3>
          <ul class="report-breakdown-list">
            ${topReasons.length > 0 ? topReasons.map(([r, p]) => 
              `<li><span>${r}</span><strong>${p > 0 ? '+' : ''}${p}</strong></li>`
            ).join('') : '<li>尚無紀錄</li>'}
          </ul>
        </div>
        <div class="report-breakdown-block">
          <h3>出席與作業</h3>
          <ul class="report-breakdown-list">
            <li><span>出席天數</span><strong>${presentDays} 天</strong></li>
            <li><span>遲到天數</span><strong>${lateDays} 天</strong></li>
            <li><span>缺席天數</span><strong>${absentDays} 天</strong></li>
            <li><span>已繳作業</span><strong>${hwSubmitted}/${hwTotal}</strong></li>
            <li><span>遲交作業</span><strong>${hwLate}/${hwTotal}</strong></li>
          </ul>
        </div>
      </div>
      
      ${Object.keys(itemCounts).length > 0 ? `
        <h2>守護獸照料(商店紀錄)</h2>
        <div class="report-narrative">
          ${s.name} 在本學期共為守護獸購買了 ${purchases.length} 次物品,包含:${Object.entries(itemCounts).map(([n, c]) => n + (c > 1 ? ' × ' + c : '')).join('、')}。
        </div>
      ` : ''}
      
      <h2>導師評語</h2>
      <div class="report-narrative" id="reportNarrative" contenteditable="true" 
        style="border: 1px dashed #ccc; min-height: 80px;">${buildAutoNarrative(s, stage, attendanceRate, hwRate, topReasons)}</div>
      <div style="font-size: 11px; color: #999; margin-top: 4px;">✦ 此區域可直接點擊編輯;若已設定 AI 助手,可於 AI 頁面用更詳細的觀察生成更個人化的評語。</div>
      
      <div class="report-footer">
        守護獸學園 · ${state.className} · 班導:${state.teacherName}
      </div>
    </div>
    
    <div style="margin-top: 16px; display: flex; gap: 10px; justify-content: center;">
      <button class="btn btn-primary" onclick="printStudentReport()">🖨 列印此報告</button>
      <button class="btn btn-ghost" onclick="document.getElementById('reportContainer').innerHTML=''; renderReportStudentList();">返回列表</button>
    </div>
  `;
}

function computeWeeklyPoints(student) {
  const weeks = [];
  const now = new Date();
  // 取最近 8 週
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const startMs = weekStart.setHours(0,0,0,0);
    const endMs = weekEnd.setHours(23,59,59,999);
    
    const weekPts = (student.history || [])
      .filter(h => h.time >= startMs && h.time <= endMs)
      .reduce((s, h) => s + h.points, 0);
    
    const label = (weekStart.getMonth() + 1) + '/' + weekStart.getDate();
    weeks.push({ label, points: weekPts });
  }
  return weeks;
}

function buildAutoNarrative(s, stage, attRate, hwRate, topReasons) {
  let n = '';
  const stageText = STAGE_NAMES[stage];
  n += `${s.name}在本學期將守護獸培育至「${stageText}」階段,累積 ${s.totalPoints} 點經驗。`;
  
  if (attRate >= 95) n += '出席表現極為穩定,';
  else if (attRate >= 85) n += '出席狀況良好,';
  else if (attRate < 70) n += '出席率偏低需要關注,';
  
  if (hwRate >= 90) n += '作業繳交準時,展現責任感。';
  else if (hwRate >= 70) n += '作業繳交大致準時,偶有遺漏。';
  else n += '作業繳交需要再加強。';
  
  if (topReasons.length > 0) {
    n += '\n\n主要表現在「' + topReasons.slice(0, 2).map(r => r[0]).join('」與「') + '」方面,';
    if (topReasons[0][1] > 30) n += '展現相當突出的能力。';
    else n += '持續穩定累積。';
  }
  
  return n;
}

function printStudentReport() {
  window.print();
}

function downloadClassReport() {
  // 開新視窗匯出全班報表
  const win = window.open('', '_blank');
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${state.className} 班級總報表</title>
    <style>
      body { font-family: 'Noto Serif TC', 'PingFang TC', serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #1A1612; }
      h1 { text-align: center; border-bottom: 3px solid #2D5F47; padding-bottom: 12px; }
      h2 { color: #2D5F47; margin-top: 30px; }
      .student-block { page-break-inside: avoid; border: 1px solid #ddd; padding: 16px; margin: 16px 0; border-radius: 8px; background: #FBF6E9; }
      .name { font-size: 18px; font-weight: 700; color: #2D5F47; }
      .meta { font-size: 13px; color: #666; }
      .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; font-size: 13px; }
      .stat { background: white; padding: 8px; border-radius: 4px; }
      .stat .v { font-weight: 700; font-size: 16px; color: #2D5F47; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #2D5F47; color: white; }
      @media print { .student-block { page-break-inside: avoid; } }
    </style></head><body>
    <h1>${state.className} · 班級成長總報表</h1>
    <p style="text-align:center; color: #666;">截至 ${formatChineseDate(getTodayDate())} · ${state.teacherName}</p>
    
    <h2>班級總覽</h2>
    <table>
      <thead><tr>
        <th>學生</th><th>守護獸</th><th>階段</th>
        <th>累積經驗</th><th>出席率</th><th>作業完成率</th>
      </tr></thead>
      <tbody>
  `;
  
  state.students.forEach(s => {
    const stage = s.pet ? PetEngine.getStage(s.totalPoints) : 0;
    const species = s.pet ? PET_SPECIES.find(p => p.id === s.pet) : null;
    let pres = 0, lat = 0, tot = 0;
    Object.values(state.attendance).forEach(day => {
      if (day[s.id]) {
        tot++;
        if (day[s.id] === 'present') pres++;
        else if (day[s.id] === 'late') lat++;
      }
    });
    let hwS = 0, hwL = 0, hwTot = state.homework.length;
    state.homework.forEach(hw => {
      const sub = hw.submissions?.[s.id];
      if (sub?.status === 'submitted') hwS++;
      else if (sub?.status === 'late') hwL++;
    });
    
    html += `<tr>
      <td><strong>${s.name}</strong></td>
      <td>${species ? species.name : '—'}</td>
      <td>${s.pet ? STAGE_NAMES[stage] : '—'}</td>
      <td>${s.totalPoints}</td>
      <td>${tot > 0 ? Math.round((pres+lat)/tot*100) : 0}%</td>
      <td>${hwTot > 0 ? Math.round((hwS+hwL)/hwTot*100) : 100}%</td>
    </tr>`;
  });
  
  html += `</tbody></table>
    <p style="text-align:center; margin-top: 40px; color: #999; font-size: 12px;">守護獸學園 · 班級養成系統</p>
    <script>setTimeout(() => window.print(), 500);<\/script>
    </body></html>`;
  
  win.document.write(html);
  win.document.close();
}
