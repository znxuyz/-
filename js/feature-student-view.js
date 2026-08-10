/* ============================================
   學生端
   ────────────────────────────────────────────
   學生看得到:自己的守護獸、自己的積分、待作答的測驗。
   學生只能寫入自己的那份 submission,不能改班級資料,
   所以 30 個人同時操作也不會互相影響。
============================================ */

const StudentApp = {
  classInfo: null,      // { classId, className, studentId, name, seatNumber }
  student: null,        // 從班級 blob 取出的自己那筆資料(唯讀)
  quizzes: [],
  submissions: {},      // { quizId: submissionDoc }
  activeQuiz: null,
  draftAnswers: {},
  petChoice: null,        // 已送出但老師還沒收進班級資料的選擇
  pickedPet: null,        // 挑選畫面上目前點選的物種
  draftNickname: '',
  tab: 'pet',             // pet | rank | quiz
  rankTab: 'individual',  // individual | group
  allStudents: [],        // 全班資料,排行榜用
  groups: [],             // 目前使用的分組(id 陣列的陣列)
  groupsName: null,       // 分組名稱,老師存過才有
  unsub: null,            // 班級即時監聽
  lastScore: undefined,   // 用來偵測加分,跳出提示

  async enter(classInfo) {
    this.classInfo = classInfo;
    hideAllTopViews();
    document.getElementById('studentView').classList.remove('hidden');
    document.getElementById('studentView').innerHTML =
      '<div class="student-loading">載入中…</div>';

    await this.refresh();
    this.watch();
  },

  /* 老師一發分、一結算成績,學生畫面就跟著動。
     排行榜是即時的,搶答結果馬上看得到名次變化。 */
  watch() {
    if (this.unsub) this.unsub();
    this.unsub = Cloud.watchClass(this.classInfo.classId, doc => {
      const blob = doc.blob || {};
      this.allStudents = blob.students || [];
      this.student = this.allStudents.find(s => s.id === this.classInfo.studentId) || null;

      this.readGroups(blob);

      // 正在作答時不要重繪,會把已經選好的答案清掉
      if (this.activeQuiz) return;

      const before = this.lastScore;
      const now = this.student ? this.student.totalPoints : 0;
      this.lastScore = now;

      this.render();
      if (before !== undefined && now > before) {
        toast(`✦ 獲得 ${now - before} 分!`);
      }
    });
  },

  async refresh() {
    const { classId, studentId } = this.classInfo;

    const doc = await Cloud.loadClass(classId);
    if (!doc) {
      toast('找不到班級資料');
      return;
    }
    const blob = doc.blob || {};
    this.allStudents = blob.students || [];
    this.student = this.allStudents.find(s => s.id === studentId) || null;
    this.classRules = blob.rules || [];

    this.readGroups(blob);

    // 老師還沒把選擇收進班級資料前,先用學生自己的選擇單顯示
    this.petChoice = this.student && this.student.pet
      ? null
      : await Cloud.getMyPetChoice(classId, Cloud.uid);

    this.quizzes = await Cloud.listOpenQuizzes(classId);

    // 逐份查自己交過沒 — 開放中的測驗通常不多,這裡的查詢量很小
    this.submissions = {};
    for (const q of this.quizzes) {
      const sub = await Cloud.getMySubmission(classId, q.id, Cloud.uid);
      if (sub) this.submissions[q.id] = sub;
    }

    this.render();
  },

  /* ---------- 主畫面 ---------- */

  render() {
    if (this.activeQuiz) {
      this.renderQuizPage();
      return;
    }

    const pending = this.quizzes.filter(q => !this.submissions[q.id]).length;

    document.getElementById('studentView').innerHTML = `
      <header class="student-header">
        <div>
          <div class="student-class">${escapeHtml(this.classInfo.className)}</div>
          <div class="student-name">${escapeHtml(this.classInfo.name)}
            ${this.classInfo.seatNumber ? ' · ' + escapeHtml(this.classInfo.seatNumber) + ' 號' : ''}</div>
        </div>
        <div class="student-header-actions">
          <button class="btn btn-ghost btn-small" onclick="StudentApp.refresh()">重新整理</button>
          <button class="btn btn-ghost btn-small" onclick="Session.signOut()">登出</button>
        </div>
      </header>

      <nav class="student-tabs">
        <button class="student-tab ${this.tab === 'pet' ? 'active' : ''}"
                onclick="StudentApp.setTab('pet')">我的守護獸</button>
        <button class="student-tab ${this.tab === 'rank' ? 'active' : ''}"
                onclick="StudentApp.setTab('rank')">排行榜</button>
        <button class="student-tab ${this.tab === 'quiz' ? 'active' : ''}"
                onclick="StudentApp.setTab('quiz')">
          測驗${pending > 0 ? `<span class="student-tab-badge">${pending}</span>` : ''}
        </button>
      </nav>

      <main class="student-main">
        ${this.tab === 'pet'  ? this.renderPetTab()  : ''}
        ${this.tab === 'rank' ? this.renderRankTab() : ''}
        ${this.tab === 'quiz' ? this.renderQuizTab() : ''}
      </main>
    `;
  },

  setTab(tab) {
    this.tab = tab;
    this.render();
  },

  /* ---------- 分頁:我的守護獸 ---------- */

  renderPetTab() {
    const s = this.student;
    const petHtml = s && s.pet
      ? this.renderPet(s)
      : this.petChoice
        ? this.renderPendingPet()
        : this.renderPetPicker();

    return `
      <section class="student-pet-section">${petHtml}</section>
      <section class="student-section">
        <div class="student-section-title">最近的積分紀錄</div>
        ${this.renderHistory()}
      </section>`;
  },

  /* ---------- 分頁:測驗 ---------- */

  renderQuizTab() {
    if (this.quizzes.length === 0) {
      return '<div class="student-empty">目前沒有待作答的測驗</div>';
    }
    return this.quizzes.map(q => {
      const done = this.submissions[q.id];
      return `
      <div class="student-quiz-card ${done ? 'done' : ''}">
        <div>
          <div class="student-quiz-title">${escapeHtml(q.title)}</div>
          <div class="student-quiz-meta">
            ${q.questions.length} 題${q.dueDate ? ' · 截止 ' + q.dueDate : ''}
            ${q.scoreMode === 'topN' ? ` · 前 ${q.topN} 名得分` : ''}
          </div>
        </div>
        ${done
          ? '<span class="student-quiz-done">✓ 已交卷</span>'
          : `<button class="btn btn-accent btn-small"
               onclick="StudentApp.openQuiz('${q.id}')">開始作答</button>`}
      </div>`;
    }).join('');
  },

  /* ---------- 分頁:排行榜 ---------- */

  /* 分組來源:老師存過的分組優先,否則用目前螢幕上那份(按過「產生分組」就有)。
     老師只按產生沒按儲存也看得到,不用多教一個步驟。 */
  readGroups(blob) {
    const sets = blob.groupSets || [];
    if (sets.length > 0) {
      const latest = sets[sets.length - 1];
      this.groups = latest.groups || [];
      this.groupsName = latest.name;
    } else {
      this.groups = blob.currentGroups || [];
      this.groupsName = null;
    }
  },

  renderRankTab() {
    const hasGroups = !!(this.groups && this.groups.length);
    const showGroup = this.rankTab === 'group' && hasGroups;

    const rows = showGroup
      ? Leaderboard.groups(this.allStudents, this.groups)
      : Leaderboard.individual(this.allStudents);

    // 小組榜要高亮的是「我所屬的那一組」
    const myId = showGroup ? this.myGroupId() : this.classInfo.studentId;

    const switcher = hasGroups ? `
      <div class="rank-switch">
        <button class="rank-switch-btn ${!showGroup ? 'active' : ''}"
                onclick="StudentApp.setRankTab('individual')">個人榜</button>
        <button class="rank-switch-btn ${showGroup ? 'active' : ''}"
                onclick="StudentApp.setRankTab('group')">小組榜</button>
      </div>` : '';

    // 前三名沒變動就不重播動畫
    const sig = this.rankTab + '::' + Leaderboard.signature(rows);
    const animate = sig !== this.lastPodiumSig;
    this.lastPodiumSig = sig;

    return `
      ${switcher}
      ${showGroup && this.groupsName
        ? `<div class="rank-groupset-name">依「${escapeHtml(this.groupsName)}」分組</div>` : ''}
      ${Leaderboard.renderPodium(rows, { highlightId: myId, animate })}
      ${Leaderboard.renderMyRank(rows, myId, showGroup ? '我這組的名次' : '我的名次')}
    `;
  },

  setRankTab(tab) {
    this.rankTab = tab;
    this.render();
  },

  /* 找出自己在哪一組 */
  myGroupId() {
    if (!this.groups) return null;
    const idx = this.groups.findIndex(members =>
      (members || []).some(m => Leaderboard.memberId(m) === this.classInfo.studentId));
    return idx >= 0 ? 'g' + idx : null;
  },

  renderPet(s) {
    const stage = PetEngine.getStage(s.totalPoints);
    const species = PET_SPECIES.find(p => p.id === s.pet);
    const nextThreshold = STAGE_THRESHOLDS[stage + 1];
    const pct = nextThreshold
      ? Math.min(100, Math.round(s.totalPoints / nextThreshold * 100))
      : 100;

    return `
      <div class="student-pet-card">
        <div class="student-pet-icon">${PetEngine.getIcon(s)}</div>
        <div class="student-pet-name">${escapeHtml(s.petName || (species ? species.name : '守護獸'))}</div>
        <div class="student-pet-stage">${STAGE_NAMES[stage]}</div>
        <div class="student-points">
          <div><span class="student-points-num">${s.totalPoints}</span><span>累積經驗</span></div>
          <div><span class="student-points-num">${s.currentPoints}</span><span>可用積分</span></div>
        </div>
        <div class="student-progress">
          <div class="student-progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="student-progress-label">
          ${nextThreshold
            ? `再 ${nextThreshold - s.totalPoints} 分進化到下一階段`
            : '已達最高階段'}
        </div>
      </div>`;
  },

  /* ---------- 自選守護獸 ---------- */

  renderPetPicker() {
    const cards = PET_SPECIES.map(p => `
      <div class="pet-choice ${this.pickedPet === p.id ? 'selected' : ''}"
           onclick="StudentApp.pickPet('${p.id}')">
        <div class="pet-choice-icon">${p.icon}</div>
        <div class="pet-choice-name">${escapeHtml(p.name)}</div>
        <div class="pet-choice-desc">${escapeHtml(p.desc)}</div>
      </div>`).join('');

    return `
      <div class="pet-picker">
        <div class="pet-picker-title">選擇你的守護獸</div>
        <div class="pet-picker-sub">— 台 灣 山 林 八 神 —</div>
        <div class="pet-picker-desc">
          牠們都是台灣特有種,真實住在這座島上。<br>
          選好之後就不能更換了,慢慢挑。
        </div>
        <div class="pet-choice-grid">${cards}</div>
        <input type="text" id="petNickname" class="student-short-input"
               placeholder="幫牠取個名字(可留空)" style="margin-top:16px;" />
        <button class="btn btn-primary btn-block btn-large" style="margin-top:14px;"
                ${this.pickedPet ? '' : 'disabled'}
                onclick="StudentApp.confirmPet()">
          ${this.pickedPet ? '就選牠了' : '請先選一隻'}
        </button>
      </div>`;
  },

  pickPet(petId) {
    this.pickedPet = petId;
    // 保留使用者已經打好的名字,重繪不要清掉
    const input = document.getElementById('petNickname');
    this.draftNickname = input ? input.value : (this.draftNickname || '');
    this.render();
    const restored = document.getElementById('petNickname');
    if (restored) restored.value = this.draftNickname || '';
  },

  async confirmPet() {
    if (!this.pickedPet) return;
    const species = PET_SPECIES.find(p => p.id === this.pickedPet);
    const input = document.getElementById('petNickname');
    const nickname = (input ? input.value : '').trim();

    if (!confirm(`確定選擇「${species.name}」嗎?選好之後就不能更換了。`)) return;

    try {
      await Cloud.savePetChoice(this.classInfo.classId, Cloud.uid, {
        studentId: this.classInfo.studentId,
        studentName: this.classInfo.name,
        pet: this.pickedPet,
        petName: nickname || null
      });
      toast('✦ 守護獸已選定!');
      this.pickedPet = null;
      this.draftNickname = '';
      await this.refresh();
    } catch (e) {
      console.error(e);
      toast('選擇失敗:' + e.message);
    }
  },

  /* 已送出選擇,但老師還沒開過班級後台,尚未收進正式資料 */
  renderPendingPet() {
    const species = PET_SPECIES.find(p => p.id === this.petChoice.pet);
    if (!species) return '<div class="student-pet-empty">守護獸資料有誤,請告訴老師</div>';
    return `
      <div class="student-pet-card">
        <div class="student-pet-icon">🥚</div>
        <div class="student-pet-name">${escapeHtml(this.petChoice.petName || species.name)}</div>
        <div class="student-pet-stage">${escapeHtml(species.name)} · 靈卵</div>
        <div class="student-progress-label" style="margin-top:16px;">
          你選好了 ${species.icon} ${escapeHtml(species.name)}。<br>
          老師下次打開班級後台時,牠就會正式住進來。
        </div>
      </div>`;
  },

  renderHistory() {
    const h = (this.student && this.student.history) || [];
    if (h.length === 0) return '<div class="student-empty">還沒有積分紀錄</div>';
    return `<div class="student-history">` +
      h.slice(-10).reverse().map(r => `
        <div class="student-history-row">
          <span class="student-history-reason">${escapeHtml(r.reason)}</span>
          <span class="student-history-points ${r.points >= 0 ? 'pos' : 'neg'}">
            ${r.points >= 0 ? '+' : ''}${r.points}
          </span>
        </div>`).join('') + `</div>`;
  },

  /* ---------- 作答 ---------- */

  openQuiz(quizId) {
    this.activeQuiz = this.quizzes.find(q => q.id === quizId);
    this.draftAnswers = {};
    this.render();
  },

  closeQuiz() {
    this.activeQuiz = null;
    this.draftAnswers = {};
    this.render();
  },

  setAnswer(qId, value) {
    this.draftAnswers[qId] = value;
  },

  renderQuizPage() {
    const quiz = this.activeQuiz;
    const questions = quiz.questions.map((q, i) => `
      <div class="student-question">
        <div class="student-question-text">
          <span class="student-question-num">${i + 1}</span>${escapeHtml(q.text)}
        </div>

        ${q.type === 'choice' ? q.options.map((opt, oi) => `
          <label class="student-option">
            <input type="radio" name="sq_${q.id}" value="${oi}"
                   onchange="StudentApp.setAnswer('${q.id}', ${oi})" />
            <span class="student-option-letter">${'ABCD'[oi]}</span>
            <span>${escapeHtml(opt)}</span>
          </label>`).join('') : ''}

        ${q.type === 'truefalse' ? `
          <label class="student-option">
            <input type="radio" name="sq_${q.id}"
                   onchange="StudentApp.setAnswer('${q.id}', true)" /> ○ 正確
          </label>
          <label class="student-option">
            <input type="radio" name="sq_${q.id}"
                   onchange="StudentApp.setAnswer('${q.id}', false)" /> ✕ 錯誤
          </label>` : ''}

        ${q.type === 'short' ? `
          <input type="text" class="student-short-input" placeholder="在這裡作答"
                 oninput="StudentApp.setAnswer('${q.id}', this.value)" />` : ''}
      </div>
    `).join('');

    document.getElementById('studentView').innerHTML = `
      <header class="student-header">
        <div class="student-class">${escapeHtml(quiz.title)}</div>
        <button class="btn btn-ghost btn-small" onclick="StudentApp.closeQuiz()">← 返回</button>
      </header>
      <main class="student-main">
        ${questions}
        <button class="btn btn-primary btn-block btn-large" id="submitQuizBtn"
                onclick="StudentApp.submit()">交 卷</button>
        <div class="student-note">交卷後無法修改,請確認每題都作答了。</div>
      </main>
    `;
  },

  async submit() {
    const quiz = this.activeQuiz;
    const unanswered = quiz.questions.filter(q => {
      const a = this.draftAnswers[q.id];
      return a === undefined || a === null || a === '';
    });

    if (unanswered.length > 0) {
      if (!confirm(`還有 ${unanswered.length} 題沒作答,確定要交卷嗎?`)) return;
    }

    const btn = document.getElementById('submitQuizBtn');
    if (btn) { btn.disabled = true; btn.textContent = '送出中…'; }

    try {
      await Cloud.submitAnswers(this.classInfo.classId, quiz.id, Cloud.uid, {
        studentId: this.classInfo.studentId,
        studentName: this.classInfo.name,
        answers: this.draftAnswers
      });
      toast('✦ 已交卷!老師結算後積分會加到你的守護獸');
      this.activeQuiz = null;
      await this.refresh();
    } catch (e) {
      console.error(e);
      toast('交卷失敗:' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '交 卷'; }
    }
  }
};
