/* ============================================
   儲存模組
   ────────────────────────────────────────────
   兩種模式:
   · cloud — 已登入,資料存在 Firestore,localStorage 只當離線快取
   · local — 未登入或 Firebase 無法連線,行為與舊版完全相同

   對外只暴露 save() / Storage.load(),所有 feature-*.js 不需要修改。
============================================ */

const Storage = {
  KEY: 'guardian-classroom-v1',

  /* 每個班級各自的快取鍵,切班時不會互相覆蓋 */
  cacheKey(classId) {
    return classId ? `${this.KEY}:${classId}` : this.KEY;
  },

  load(classId) {
    try {
      const raw = localStorage.getItem(this.cacheKey(classId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Load failed:', e);
      return null;
    }
  },

  save(data, classId) {
    try {
      localStorage.setItem(this.cacheKey(classId), JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  },

  clear(classId) {
    localStorage.removeItem(this.cacheKey(classId));
  }
};

/* ============================================
   把 state 抽成可儲存的純資料
   (排除 timer intervalId 這類執行期物件)
============================================ */

/* ============================================
   分組資料的格式轉換
   ────────────────────────────────────────────
   分組在記憶體裡是「陣列的陣列」:[[學生id, 學生id], [學生id]]。
   但 Firestore 不允許陣列裡再放陣列,整份儲存會被拒絕。
   所以寫出去時包成 [{members:[...]}, ...],讀回來再拆開。
   記憶體中的形狀維持不變,分組相關的程式都不用改。
============================================ */

function encodeGroups(groups) {
  return (groups || []).map(g => ({ members: Array.isArray(g) ? g : (g.members || []) }));
}

function decodeGroups(list) {
  return (list || []).map(g => Array.isArray(g) ? g : (g.members || []));
}

function serializeState() {
  return {
    className: state.className,
    teacherName: state.teacherName,
    students: state.students,
    rules: state.rules,
    attendance: state.attendance,
    seatingLayouts: state.seatingLayouts,
    groupSets: (state.groupSets || []).map(gs => ({
      ...gs,
      groups: encodeGroups(gs.groups)
    })),
    // 未命名儲存的分組也要存,老師按過「產生分組」學生就看得到小組榜
    currentGroups: encodeGroups(state.currentGroups),
    contactBook: state.contactBook,
    homework: state.homework,
    classTasks: state.classTasks,
    shopHistory: state.shopHistory,
    quizzes: state.quizzes
  };
}

/* ============================================
   save() — 全系統唯一的儲存進入點

   雲端模式下寫入會 debounce 800ms。老師連續點五次發分時,
   只會產生一次 Firestore 寫入,省額度也避免競態。
   localStorage 則每次都立即寫,當機也不會掉資料。
============================================ */

let _cloudSaveTimer = null;
let _cloudSavePending = false;

function save() {
  const data = serializeState();

  // 本機快取一律立即寫入
  Storage.save(data, state.classId);

  if (!isCloudMode()) return;

  _cloudSavePending = true;
  updateSyncStatus('saving');

  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(flushCloudSave, 800);
}

async function flushCloudSave(isRetry) {
  if (!isCloudMode() || !_cloudSavePending) return;
  const classId = state.classId;
  const data = serializeState();
  try {
    await Cloud.saveClassBlob(classId, data, {
      className: state.className,
      teacherName: state.teacherName
    });
    _cloudSavePending = false;
    updateSyncStatus('saved');
  } catch (e) {
    console.error('[Cloud] 儲存失敗:', e.code || '', e.message, e);
    updateSyncStatus('error');

    if (!isRetry) {
      // 網路瞬斷之類的暫時性錯誤,再試一次通常就過了
      setTimeout(() => flushCloudSave(true), 3000);
      return;
    }

    // 兩次都失敗。資料還在 localStorage,但這個旗標不能一直留著 ——
    // 它會擋住班級的即時監聽,讓整個 App 之後都收不到任何更新。
    _cloudSavePending = false;
    toast('雲端儲存失敗(' + (e.code || e.message) + '),資料已暫存在本機');
  }
}

/* 關閉分頁前把還沒送出的寫入補送 */
window.addEventListener('beforeunload', () => {
  if (_cloudSavePending) flushCloudSave();
});

function isCloudMode() {
  return !!(Cloud.ready && Cloud.uid && state.classId);
}

/* 同步狀態指示燈 — 元素不存在時安靜略過 */
function updateSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const map = {
    saving: { text: '同步中…', cls: 'syncing' },
    saved:  { text: '已同步',   cls: 'synced' },
    error:  { text: '同步失敗', cls: 'error' },
    local:  { text: '單機模式', cls: 'local' }
  };
  const s = map[status] || map.local;
  el.textContent = s.text;
  el.className = 'sync-status ' + s.cls;
}
