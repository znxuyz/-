/* ============================================
   聯絡簿
============================================ */
function ensureContactDate() {
  if (!state.currentContactDate) {
    state.currentContactDate = getTodayDate();
  }
  const date = state.currentContactDate;
  if (!state.contactBook[date]) {
    state.contactBook[date] = {
      classNote: '',
      teacherMessage: '',
      studentNotes: {},
      autoLog: []  // [{ type, text, time }]
    };
  }
  return state.contactBook[date];
}

function logToContactBook(type, text) {
  const entry = ensureContactDate();
  if (!entry.autoLog) entry.autoLog = [];
  entry.autoLog.push({ type, text, time: Date.now() });
  save();
}

function changeContactDate() {
  const newDate = document.getElementById('contactDatePicker').value;
  if (newDate) {
    state.currentContactDate = newDate;
    renderContactDiary();
  }
}

function renderContactDiary() {
  ensureContactDate();
  const date = state.currentContactDate;
  const entry = state.contactBook[date];
  
  document.getElementById('contactDateDisplay').textContent = formatChineseDate(date);
  document.getElementById('contactDatePicker').value = date;
  
  renderContactAutoBlock(date);
  
  document.getElementById('teacherMessageBox').value = entry.teacherMessage || '';
  document.getElementById('classNoteBox').value = entry.classNote || '';
  
  renderStudentNotesList(date);
}

function renderContactAutoBlock(date) {
  const block = document.getElementById('contactAutoBlock');
  const lines = [];
  
  // 點名統計
  const attendance = state.attendance[date];
  if (attendance) {
    let present = 0, absent = 0, late = 0;
    const absentNames = [];
    const lateNames = [];
    state.students.forEach(s => {
      const st = attendance[s.id];
      if (st === 'present') present++;
      else if (st === 'absent') { absent++; absentNames.push(s.name); }
      else if (st === 'late') { late++; lateNames.push(s.name); }
    });
    if (present + absent + late > 0) {
      let line = `出席 ${present} 位`;
      if (absent > 0) line += `、缺席 ${absent} 位(${absentNames.join('、')})`;
      if (late > 0) line += `、遲到 ${late} 位(${lateNames.join('、')})`;
      lines.push({ tag: '點名', text: line });
    }
  }
  
  // 今日作業
  const todayHw = state.homework.filter(h => h.assignedDate === date && !h.archived);
  todayHw.forEach(h => {
    const subs = Object.values(h.submissions || {});
    const submitted = subs.filter(s => s.status === 'submitted').length;
    lines.push({ 
      tag: '作業', 
      text: `${h.name}${h.description ? '(' + h.description + ')' : ''} · 已繳交 ${submitted}/${state.students.length}` 
    });
  });
  
  // 今日積分異動
  const todayStart = new Date(date).setHours(0,0,0,0);
  const todayEnd = todayStart + 24*60*60*1000;
  const noteworthy = [];
  state.students.forEach(s => {
    const todayPoints = (s.history || [])
      .filter(h => h.time >= todayStart && h.time < todayEnd)
      .reduce((sum, h) => sum + h.points, 0);
    if (todayPoints !== 0) {
      noteworthy.push({ name: s.name, points: todayPoints });
    }
  });
  if (noteworthy.length > 0) {
    noteworthy.sort((a, b) => b.points - a.points);
    const top = noteworthy.slice(0, 3).map(n => `${n.name} ${n.points > 0 ? '+' : ''}${n.points}`).join('、');
    lines.push({ tag: '積分', text: `今日積分變動 ${noteworthy.length} 人,前三:${top}` });
  }
  
  // 寵物升級事件
  const entry = state.contactBook[date];
  const levelups = (entry.autoLog || []).filter(l => l.type === 'petLevelup');
  if (levelups.length > 0) {
    lines.push({ tag: '進化', text: levelups.map(l => l.text).join(' · ') });
  }
  
  // 渲染
  if (lines.length === 0) {
    block.innerHTML = '<div style="color: var(--ink-muted); font-style: italic;">今日尚無自動匯整資料(完成點名、作業批改或發放積分後,這裡會自動更新)</div>';
  } else {
    block.innerHTML = lines.map(l => `
      <div class="auto-line">
        <span class="auto-tag">${l.tag}</span>
        <span>${l.text}</span>
      </div>
    `).join('');
  }
}

function renderStudentNotesList(date) {
  const list = document.getElementById('studentNotesList');
  const entry = state.contactBook[date];
  
  list.innerHTML = state.students.map(s => {
    const note = (entry.studentNotes && entry.studentNotes[s.id]) || '';
    const icon = s.pet ? PetEngine.getIcon(s) : '❓';
    return `
      <div class="student-note-row">
        <div class="student-note-name">
          <span style="font-size:16px;">${icon}</span>
          <span>${s.name}</span>
        </div>
        <textarea class="student-note-input" 
          data-student-id="${s.id}"
          placeholder="為這位學生加個人備註..."
          oninput="saveStudentNote('${s.id}', this.value)">${note}</textarea>
      </div>
    `;
  }).join('');
}

function saveStudentNote(studentId, value) {
  const entry = ensureContactDate();
  if (!entry.studentNotes) entry.studentNotes = {};
  entry.studentNotes[studentId] = value;
  save();
}

function saveContactBook() {
  const entry = ensureContactDate();
  entry.teacherMessage = document.getElementById('teacherMessageBox').value;
  entry.classNote = document.getElementById('classNoteBox').value;
  save();
}

function generateContactBookDraft() {
  const entry = ensureContactDate();
  const date = state.currentContactDate;
  
  // 從現有資料生成「老師留言給全班」草稿
  const todayHw = state.homework.filter(h => h.assignedDate === date && !h.archived);
  let draft = '';
  
  if (todayHw.length > 0) {
    draft += '【今日作業】\n';
    todayHw.forEach((h, i) => {
      draft += `${i+1}. ${h.name}`;
      if (h.description) draft += ` — ${h.description}`;
      draft += '\n';
    });
    draft += '\n';
  }
  
  const attendance = state.attendance[date];
  if (attendance) {
    const absent = state.students.filter(s => attendance[s.id] === 'absent');
    if (absent.length > 0) {
      draft += `【今日缺席】${absent.map(s => s.name).join('、')}\n`;
    }
  }
  
  if (draft && (!entry.teacherMessage || confirm('已有留言內容,是否覆蓋?'))) {
    entry.teacherMessage = draft.trim();
    document.getElementById('teacherMessageBox').value = entry.teacherMessage;
    save();
    toast('已生成聯絡簿草稿');
  } else if (!draft) {
    toast('今日尚無可生成的資料');
  }
}

function printContactBook() {
  const date = state.currentContactDate;
  const entry = state.contactBook[date];
  
  // 生成可列印的 HTML 並開新視窗
  const win = window.open('', '_blank');
  let html = `
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <title>聯絡簿 - ${formatChineseDate(date)}</title>
      <style>
        body { font-family: 'Noto Serif TC', 'PingFang TC', serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1A1612; line-height: 1.7; }
        h1 { text-align: center; border-bottom: 3px solid #2D5F47; padding-bottom: 12px; }
        h2 { color: #2D5F47; border-left: 4px solid #D4A446; padding-left: 12px; margin-top: 24px; }
        .meta { color: #6B5F4F; text-align: center; margin-bottom: 24px; font-size: 14px; }
        .section { margin: 20px 0; padding: 16px; background: #FBF6E9; border-radius: 6px; white-space: pre-wrap; }
        .student-block { page-break-inside: avoid; padding: 12px 16px; margin: 8px 0; background: #FBF6E9; border-left: 3px solid #4A7C59; border-radius: 4px; }
        .student-name { font-weight: 700; margin-bottom: 6px; }
        .footer { margin-top: 40px; text-align: center; color: #6B5F4F; font-size: 12px; }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head><body>
      <h1>${state.className} 聯絡簿</h1>
      <div class="meta">${formatChineseDate(date)} · ${state.teacherName}</div>
  `;
  
  if (entry.teacherMessage) {
    html += `<h2>老師留言</h2><div class="section">${entry.teacherMessage}</div>`;
  }
  
  if (entry.classNote) {
    html += `<h2>班級備註</h2><div class="section">${entry.classNote}</div>`;
  }
  
  // 個別學生備註
  const hasNotes = entry.studentNotes && Object.values(entry.studentNotes).some(n => n && n.trim());
  if (hasNotes) {
    html += `<h2>個別備註</h2>`;
    state.students.forEach(s => {
      const note = entry.studentNotes[s.id];
      if (note && note.trim()) {
        html += `<div class="student-block"><div class="student-name">${s.name}</div><div>${note}</div></div>`;
      }
    });
  }
  
  html += `<div class="footer">守護獸學園 · ${state.className}</div>`;
  html += `<script>setTimeout(() => window.print(), 500);<\/script></body></html>`;
  
  win.document.write(html);
  win.document.close();
}
