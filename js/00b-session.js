/* ============================================
   登入與班級切換
   ────────────────────────────────────────────
   啟動流程:
     1. Cloud.init() 成功 → 顯示登入畫面,等 Google 登入
     2. 登入後判斷身份:
        · 名下有班級 或 role=teacher → 老師,進入班級選擇
        · rosterIndex 查得到 email     → 學生,進入學生端
        · 兩者皆無                     → 顯示「請老師先匯入你的信箱」
     3. Cloud.init() 失敗 → 完全退回舊版單機模式
============================================ */

const Session = {

  /* 系統啟動點,取代舊版直接呼叫 init() */
  async boot() {
    const ok = Cloud.init();
    if (!ok) {
      // 沒有網路或 SDK 掛掉:維持舊行為,資料存本機
      updateSyncStatus('local');
      initLocalMode();
      return;
    }

    showAuthView();
    Cloud.onAuthChanged(async user => {
      if (!user) {
        showAuthView();
        return;
      }
      try {
        state.user = await Cloud.getOrCreateUser(user);
        await this.route();
      } catch (e) {
        console.error('[Session] 登入後處理失敗:', e);
        toast('讀取帳號資料失敗:' + e.message);
        showAuthView();
      }
    });
  },

  /* 依身份決定進入老師端或學生端 */
  async route() {
    const email = (state.user.email || '').toLowerCase();
    const myClasses = await Cloud.listTeacherClasses(state.user.uid);

    if (myClasses.length > 0 || state.user.role === 'teacher') {
      state.user.role = 'teacher';
      state.myClasses = myClasses;
      showClassPicker();
      return;
    }

    const studentClasses = await Cloud.findMyClasses(email);
    if (studentClasses.length > 0) {
      state.myClasses = studentClasses;
      showStudentClassPicker();
      return;
    }

    // 沒有任何身份 — 讓使用者自己選要建班(老師)還是等待被加入(學生)
    showRoleChoice();
  },

  async signIn() {
    try {
      await Cloud.signInWithGoogle();
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') return;
      console.error(e);
      toast('登入失敗:' + e.message);
    }
  },

  async signOut() {
    await flushCloudSave();
    await Cloud.signOut();
    state.classId = null;
    state.user = null;
    location.reload();
  },

  /* ---------- 老師:建立與開啟班級 ---------- */

  async createClass(className, teacherName) {
    const blank = {
      className,
      teacherName,
      students: [],
      rules: [...DEFAULT_RULES],
      attendance: {},
      seatingLayouts: [],
      groupSets: [],
      contactBook: {},
      homework: [],
      classTasks: [],
      shopHistory: [],
      quizzes: []
    };
    const { id } = await Cloud.createClass(
      state.user.uid, className, teacherName, blank
    );
    if (state.user.role !== 'teacher') {
      await Cloud.promoteToTeacher(state.user.uid);
      state.user.role = 'teacher';
    }
    state.myClasses = await Cloud.listTeacherClasses(state.user.uid);
    await this.openClass(id);
  },

  /* 載入某個班級的資料到 state,並進入主介面 */
  async openClass(classId) {
    const doc = await Cloud.loadClass(classId);
    if (!doc) {
      toast('找不到這個班級,可能已被刪除');
      return;
    }
    applyBlobToState(doc.blob || {});
    state.classId = classId;
    state.joinCode = doc.joinCode;
    state.className = doc.className || state.className;
    state.teacherName = doc.teacherName || state.teacherName;
    updateSyncStatus('saved');
    showApp();
  },

  /* 切班前先把未送出的寫入補完,避免資料留在上一班 */
  async switchClass(classId) {
    await flushCloudSave();
    await this.openClass(classId);
  }
};

/* ============================================
   把雲端 blob 套進 state,並補齊舊資料缺少的欄位
============================================ */
function applyBlobToState(blob) {
  state.className     = blob.className || '';
  state.teacherName   = blob.teacherName || '';
  state.students      = blob.students || [];
  state.rules         = blob.rules && blob.rules.length ? blob.rules : [...DEFAULT_RULES];
  state.attendance    = blob.attendance || {};
  state.seatingLayouts = blob.seatingLayouts || [];
  state.groupSets     = blob.groupSets || [];
  state.contactBook   = blob.contactBook || {};
  state.homework      = blob.homework || [];
  state.classTasks    = blob.classTasks || [];
  state.shopHistory   = blob.shopHistory || [];
  state.quizzes       = blob.quizzes || [];
  state.selectedStudentId = null;
  state.students.forEach(migrateStudent);
}

/* ============================================
   單機模式 — 與改版前行為相同
============================================ */
function initLocalMode() {
  const saved = Storage.load();
  if (saved) {
    applyBlobToState(saved);
    showApp();
  } else {
    showSetup();
  }
}
