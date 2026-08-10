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

  async enter(classInfo) {
    this.classInfo = classInfo;
    hideAllTopViews();
    document.getElementById('studentView').classList.remove('hidden');
    document.getElementById('studentView').innerHTML =
      '<div class="student-loading">載入中…</div>';

    await this.refresh();
  },

  async refresh() {
    const { classId, studentId } = this.classInfo;

    const doc = await Cloud.loadClass(classId);
    if (!doc) {
      toast('找不到班級資料');
      return;
    }
    const blob = doc.blob || {};
    this.student = (blob.students || []).find(s => s.id === studentId) || null;
    this.classRules = blob.rules || [];

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

    const s = this.student;
    const petHtml = s && s.pet ? this.renderPet(s) : `
      <div class="student-pet-empty">
        老師還沒幫你選守護獸,或你還沒開始集分。
      </div>`;

    const quizHtml = this.quizzes.length === 0
      ? '<div class="student-empty">目前沒有待作答的測驗</div>'
      : this.quizzes.map(q => {
          const done = this.submissions[q.id];
          return `
          <div class="student-quiz-card ${done ? 'done' : ''}">
            <div>
              <div class="student-quiz-title">${escapeHtml(q.title)}</div>
              <div class="student-quiz-meta">
                ${q.questions.length} 題${q.dueDate ? ' · 截止 ' + q.dueDate : ''}
              </div>
            </div>
            ${done
              ? '<span class="student-quiz-done">✓ 已交卷</span>'
              : `<button class="btn btn-accent btn-small"
                   onclick="StudentApp.openQuiz('${q.id}')">開始作答</button>`}
          </div>`;
        }).join('');

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

      <main class="student-main">
        <section class="student-pet-section">${petHtml}</section>

        <section class="student-section">
          <div class="student-section-title">我的測驗</div>
          ${quizHtml}
        </section>

        <section class="student-section">
          <div class="student-section-title">最近的積分紀錄</div>
          ${this.renderHistory()}
        </section>
      </main>
    `;
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
