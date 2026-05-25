/* ============================================
   設定頁
============================================ */
function renderSettings() {
  document.getElementById('settingsClassName').value = state.className;
  document.getElementById('settingsTeacherName').value = state.teacherName;
  document.getElementById('settingsStudents').value = state.students.map(s => s.name).join('\n');
  loadApiKeyToUI();
}

function saveSettings() {
  state.className = document.getElementById('settingsClassName').value.trim() || state.className;
  state.teacherName = document.getElementById('settingsTeacherName').value.trim() || state.teacherName;
  save();
  renderAll();
  toast('已儲存');
}

function updateStudents() {
  const text = document.getElementById('settingsStudents').value.trim();
  const newNames = text.split('\n').map(s => s.trim()).filter(s => s);
  
  // 保留現有學生(用名字比對),新增不存在的
  const existing = new Map(state.students.map(s => [s.name, s]));
  const updated = newNames.map((name, i) => {
    return existing.get(name) || createStudent(name, Date.now() + i);
  });
  
  state.students = updated;
  save();
  renderAll();
  toast('學生名單已更新');
}

function resetAll() {
  if (!confirm('確定要清除所有資料嗎?此動作無法復原。')) return;
  Storage.clear();
  location.reload();
}
