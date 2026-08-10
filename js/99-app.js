/* ============================================
   渲染:整體
   呼叫所有區塊的渲染函式,當資料變動時可呼叫此函式重新繪製整個 App
============================================ */

function renderAll() {
  const header = document.getElementById('headerClassName');
  if (header) header.textContent = state.className;
  
  const teacher = document.getElementById('headerTeacherName');
  if (teacher) teacher.textContent = state.teacherName;
  
  const proj = document.getElementById('projClassName');
  if (proj) proj.textContent = state.className;
  
  renderStudentList();
  renderQuizList();
  renderSelectedStudent();
  renderRuleGrid();
  renderProjector();
  renderRulesEditor();
  renderOverview();
  renderSettings();
}

/* ============================================
   啟動
============================================ */

document.addEventListener('DOMContentLoaded', () => {
  Session.boot();
});
