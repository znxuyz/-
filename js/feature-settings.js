/* ============================================
   設定頁
============================================ */
function renderSettings() {
  document.getElementById('settingsClassName').value = state.className;
  document.getElementById('settingsTeacherName').value = state.teacherName;
  document.getElementById('settingsStudents').value = state.students.map(s => s.name).join('\n');
  loadApiKeyToUI();
  renderThemeChoice();
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

async function resetAll() {
  const target = state.classId
    ? `班級「${state.className}」的雲端資料`
    : '本機的所有資料';
  if (!confirm(`確定要清除${target}嗎?此動作無法復原。`)) return;

  // 雲端模式下再確認一次 — 這會刪掉整個班,不只是這台電腦的資料
  if (state.classId) {
    if (!confirm('這會連同其他裝置上的資料一起刪除,包含學生的守護獸與所有測驗成績。真的要刪除嗎?')) return;
    try {
      await Cloud.deleteClass(state.classId);
    } catch (e) {
      console.error(e);
      toast('刪除失敗:' + e.message);
      return;
    }
  }

  Storage.clear(state.classId);
  location.reload();
}

/* ============================================
   外觀主題
   ────────────────────────────────────────────
   只是換 <html data-theme>,樣式全在 css/theme-aurora.css 裡,
   所以切換不需要重新載入,也不會動到任何資料。
============================================ */
function setTheme(name) {
  document.documentElement.dataset.theme = name;
  localStorage.setItem('guardian_theme', name);
  renderThemeChoice();
  toast(name === 'aurora' ? '已切換為「極光」' : '已切換為「紙感」');
}

function renderThemeChoice() {
  const now = document.documentElement.dataset.theme || 'aurora';
  document.querySelectorAll('[data-theme-pick]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themePick === now);
  });
}
