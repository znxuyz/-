/* ============================================
   設定頁
============================================ */
function renderSettings() {
  document.getElementById('settingsClassName').value = state.className;
  document.getElementById('settingsTeacherName').value = state.teacherName;
  document.getElementById('settingsStudents').value =
    state.students.map(s => [s.seatNumber || '', s.name, s.email || ''].join(',')).join('\n');
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

/* 一行 = 一位學生:座號,姓名,信箱
   分隔符號逗號、全形逗號、Tab 都接受;只填姓名也可以。 */
function parseRosterLine(line) {
  const parts = line.split(/[,、\t]/).map(s => s.trim());

  // 只寫了名字的那一行,座號與信箱回傳 null(= 沒提供),不是空字串(= 清空)。
  // 不這樣分的話,老師習慣性貼一份純名單就會把全班的座號和信箱洗掉。
  if (parts.length === 1) return { seatNumber: null, name: parts[0], email: null };

  // 有些人習慣把姓名放前面。哪一格看起來像信箱就當信箱,
  // 純數字的那格就是座號,剩下的是姓名 —— 順序寫反也不會壞。
  const email = parts.find(p => p.includes('@')) || '';
  const rest = parts.filter(p => p !== email && p !== '');
  const seat = rest.find(p => /^\d{1,3}$/.test(p)) || '';
  const name = rest.filter(p => p !== seat).join(' ') || rest[0] || '';

  return { seatNumber: seat, name, email };
}

function updateStudents() {
  const text = document.getElementById('settingsStudents').value.trim();
  const rows = text.split('\n').map(l => l.trim()).filter(l => l).map(parseRosterLine)
    .filter(r => r.name);

  if (rows.length === 0) { toast('名單是空的'); return; }

  const dupSeat = rows.map(r => r.seatNumber).filter(Boolean);
  if (new Set(dupSeat).size !== dupSeat.length) {
    if (!confirm('有重複的座號,還是要更新嗎?')) return;
  }

  /* 比對順序:信箱 → 座號 → 姓名。
     這樣改名字的學生仍然接得回原本的守護獸與積分 ——
     只用姓名比對的話,改個字就等於變成新學生,積分全部歸零。 */
  const byEmail = new Map(), bySeat = new Map(), byName = new Map();
  state.students.forEach(s => {
    if (s.email) byEmail.set(s.email.trim().toLowerCase(), s);
    if (s.seatNumber) bySeat.set(String(s.seatNumber), s);
    byName.set(s.name, s);
  });

  const used = new Set();
  const pick = r => {
    const hit = (r.email && byEmail.get(r.email.toLowerCase()))
             || (r.seatNumber && bySeat.get(String(r.seatNumber)))
             || byName.get(r.name);
    if (!hit || used.has(hit.id)) return null;
    used.add(hit.id);
    return hit;
  };

  const updated = rows.map((r, i) => {
    const s = pick(r);
    if (!s) {
      const fresh = createStudent(r.name, Date.now() + i);
      fresh.seatNumber = r.seatNumber || '';
      fresh.email = r.email || '';
      return fresh;
    }
    s.name = r.name;
    if (r.seatNumber !== null) s.seatNumber = r.seatNumber;
    if (r.email !== null) s.email = r.email;
    return s;
  });

  const removed = state.students.length - used.size;
  const added = updated.length - used.size;
  state.students = updated;
  save();
  renderAll();

  toast(`名單已更新:${updated.length} 位` +
        (added > 0 ? `,新增 ${added}` : '') +
        (removed > 0 ? `,移除 ${removed}` : ''));

  // 信箱可能改了,學生的登入對應要跟著更新
  syncRosterAfterImport();
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
