/* ============================================
   作業測驗 — 老師端
   ────────────────────────────────────────────
   題目與設定存在班級 blob 的 state.quizzes,
   學生的作答存在 Firestore 的 submissions 子集合。

   為什麼要分開存?
   30 位學生同時交卷,如果都寫同一份文件會互相覆蓋。
   讓每位學生只寫自己那一份,寫入永遠不會衝突。
   老師端再把成績「收回來」結算成積分。
============================================ */

const QUESTION_TYPES = {
  choice: '選擇題',
  truefalse: '是非題',
  short: '簡答題'
};

function createQuiz() {
  const title = document.getElementById('quizTitle').value.trim();
  const dueDate = document.getElementById('quizDueDate').value;
  const pointsPer = parseInt(document.getElementById('quizPoints').value) || 1;

  if (!title) {
    toast('請輸入測驗名稱');
    return;
  }

  state.quizzes.unshift({
    id: 'qz_' + Date.now(),
    title,
    dueDate: dueDate || '',
    pointsPerQuestion: pointsPer,
    questions: [],
    status: 'draft',          // draft(編輯中) / open(開放作答) / closed(已結束)
    createdAt: Date.now()
  });

  document.getElementById('quizTitle').value = '';
  document.getElementById('quizDueDate').value = '';
  save();
  renderQuizList();
  toast('測驗已建立,接著新增題目');
}

function getQuiz(quizId) {
  return state.quizzes.find(q => q.id === quizId);
}

function addQuestion(quizId) {
  const quiz = getQuiz(quizId);
  if (!quiz) return;
  quiz.questions.push({
    id: 'q_' + Date.now(),
    type: 'choice',
    text: '',
    options: ['', '', '', ''],
    answer: 0            // 選擇題:選項索引 / 是非題:true|false / 簡答題:文字
  });
  save();
  renderQuizList();
}

function updateQuestion(quizId, qId, field, value) {
  const quiz = getQuiz(quizId);
  const q = quiz && quiz.questions.find(x => x.id === qId);
  if (!q) return;

  if (field === 'type') {
    q.type = value;
    // 換題型時把答案重設成該題型的合理預設,避免留下上一種題型的殘值
    if (value === 'choice')      { q.options = q.options && q.options.length ? q.options : ['', '', '', '']; q.answer = 0; }
    else if (value === 'truefalse') { q.answer = true; }
    else                          { q.answer = ''; }
  } else if (field.startsWith('option')) {
    const idx = parseInt(field.replace('option', ''));
    q.options[idx] = value;
  } else if (field === 'answer') {
    q.answer = q.type === 'choice' ? parseInt(value)
             : q.type === 'truefalse' ? (value === 'true')
             : value;
  } else {
    q[field] = value;
  }
  save();
}

function deleteQuestion(quizId, qId) {
  const quiz = getQuiz(quizId);
  if (!quiz) return;
  quiz.questions = quiz.questions.filter(x => x.id !== qId);
  save();
  renderQuizList();
}

function deleteQuiz(quizId) {
  const quiz = getQuiz(quizId);
  if (!quiz) return;
  if (!confirm(`確定刪除「${quiz.title}」?學生已交的作答也會一併看不到。`)) return;
  state.quizzes = state.quizzes.filter(q => q.id !== quizId);
  save();
  renderQuizList();
  toast('已刪除');
}

/* 開放作答:題目寫進 Firestore,學生端才讀得到 */
async function publishQuiz(quizId) {
  const quiz = getQuiz(quizId);
  if (!quiz) return;

  if (quiz.questions.length === 0) {
    toast('至少要有一題才能開放作答');
    return;
  }
  const incomplete = quiz.questions.filter(q => !q.text.trim());
  if (incomplete.length > 0) {
    toast(`有 ${incomplete.length} 題還沒填題目內容`);
    return;
  }

  quiz.status = 'open';
  save();

  if (isCloudMode()) {
    try {
      await Cloud.publishQuiz(state.classId, quiz);
      toast('✦ 已開放作答,學生登入後就會看到');
    } catch (e) {
      console.error(e);
      quiz.status = 'draft';
      save();
      toast('開放失敗:' + e.message);
    }
  } else {
    toast('單機模式下學生無法作答,請先登入雲端');
  }
  renderQuizList();
}

async function closeQuiz(quizId) {
  const quiz = getQuiz(quizId);
  if (!quiz) return;
  quiz.status = 'closed';
  save();
  if (isCloudMode()) {
    try {
      await Cloud.setQuizStatus(state.classId, quizId, 'closed');
    } catch (e) {
      console.error(e);
    }
  }
  renderQuizList();
  toast('已結束作答');
}

/* ============================================
   收回成績並結算積分
   ────────────────────────────────────────────
   每位學生每份測驗只會加分一次(以 quizResults 為準),
   老師重複按「收回成績」不會重複加分。
============================================ */

async function collectQuizResults(quizId) {
  if (!isCloudMode()) {
    toast('需要登入雲端才能收回學生作答');
    return;
  }
  const quiz = getQuiz(quizId);
  if (!quiz) return;

  toast('讀取中…');
  let submissions;
  try {
    submissions = await Cloud.listSubmissions(state.classId, quizId);
  } catch (e) {
    console.error(e);
    toast('讀取失敗:' + e.message);
    return;
  }

  let newlyAwarded = 0;
  let totalPoints = 0;

  submissions.forEach(sub => {
    const student = state.students.find(s => s.id === sub.studentId);
    if (!student) return;

    if (!student.quizResults) student.quizResults = {};
    if (student.quizResults[quizId]) return;   // 已結算過,跳過

    // 批改在這裡做 — 正確答案只存在老師端,學生拿不到
    const score = gradeSubmission(quiz, sub.answers || {});
    const points = score * quiz.pointsPerQuestion;

    student.quizResults[quizId] = {
      score,
      total: quiz.questions.length,
      awarded: points,
      at: sub.submittedAt
    };

    if (points > 0) {
      applyPointsToStudent(student.id, points,
        `測驗「${quiz.title}」答對 ${score}/${quiz.questions.length} 題`);
      totalPoints += points;
    }
    newlyAwarded++;
  });

  save();
  renderAll();

  if (newlyAwarded === 0) {
    toast(`目前 ${submissions.length} 份作答都已結算過`);
  } else {
    toast(`✦ 結算 ${newlyAwarded} 位學生,共發出 ${totalPoints} 分`);
  }
}

/* 批改一份作答,回傳答對題數 */
function gradeSubmission(quiz, answers) {
  let score = 0;
  quiz.questions.forEach(q => {
    const given = answers[q.id];
    if (given === undefined || given === null) return;

    if (q.type === 'choice') {
      if (Number(given) === Number(q.answer)) score++;
    } else if (q.type === 'truefalse') {
      if (Boolean(given) === Boolean(q.answer)) score++;
    } else {
      // 簡答題:忽略大小寫、前後空白與全形空白
      const norm = v => String(v).trim().replace(/\s+/g, '').toLowerCase();
      if (norm(given) === norm(q.answer)) score++;
    }
  });
  return score;
}

/* ============================================
   渲染
============================================ */

function renderQuizList() {
  const el = document.getElementById('quizList');
  if (!el) return;

  if (state.quizzes.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">✎</div>
      <div>還沒有測驗,用上方表單建立第一份</div>
    </div>`;
    return;
  }

  el.innerHTML = state.quizzes.map(quiz => {
    const submitted = state.students.filter(s => s.quizResults && s.quizResults[quiz.id]).length;
    const statusLabel = { draft: '編輯中', open: '開放作答', closed: '已結束' }[quiz.status];

    return `
    <div class="quiz-card quiz-${quiz.status}">
      <div class="quiz-card-head">
        <div>
          <div class="quiz-card-title">${escapeHtml(quiz.title)}</div>
          <div class="quiz-card-meta">
            ${quiz.questions.length} 題 · 每題 ${quiz.pointsPerQuestion} 分
            ${quiz.dueDate ? ' · 截止 ' + quiz.dueDate : ''}
            · 已結算 ${submitted}/${state.students.length} 人
          </div>
        </div>
        <div class="quiz-card-actions">
          <span class="quiz-status quiz-status-${quiz.status}">${statusLabel}</span>
          ${quiz.status === 'draft'
            ? `<button class="btn btn-accent btn-small" onclick="publishQuiz('${quiz.id}')">開放作答</button>`
            : ''}
          ${quiz.status === 'open'
            ? `<button class="btn btn-primary btn-small" onclick="collectQuizResults('${quiz.id}')">收回成績</button>
               <button class="btn btn-ghost btn-small" onclick="closeQuiz('${quiz.id}')">結束</button>`
            : ''}
          ${quiz.status === 'closed'
            ? `<button class="btn btn-primary btn-small" onclick="collectQuizResults('${quiz.id}')">收回成績</button>`
            : ''}
          <button class="btn btn-ghost btn-small" onclick="deleteQuiz('${quiz.id}')">刪除</button>
        </div>
      </div>

      ${quiz.status === 'draft' ? renderQuizEditor(quiz) : renderQuizResults(quiz)}
    </div>`;
  }).join('');
}

function renderQuizEditor(quiz) {
  const questions = quiz.questions.map((q, i) => `
    <div class="question-editor">
      <div class="question-editor-head">
        <span class="question-num">第 ${i + 1} 題</span>
        <select class="rule-editor-input" style="max-width:120px;"
                onchange="updateQuestion('${quiz.id}','${q.id}','type',this.value); renderQuizList()">
          ${Object.entries(QUESTION_TYPES).map(([k, v]) =>
            `<option value="${k}" ${q.type === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <div style="flex:1;"></div>
        <button class="btn btn-ghost btn-small" onclick="deleteQuestion('${quiz.id}','${q.id}')">✕</button>
      </div>

      <input type="text" class="rule-editor-input" placeholder="題目內容"
             value="${escapeHtml(q.text)}"
             onchange="updateQuestion('${quiz.id}','${q.id}','text',this.value)" />

      ${q.type === 'choice' ? `
        <div class="option-list">
          ${q.options.map((opt, oi) => `
            <label class="option-row">
              <input type="radio" name="ans_${q.id}" ${q.answer === oi ? 'checked' : ''}
                     onchange="updateQuestion('${quiz.id}','${q.id}','answer','${oi}')" />
              <span class="option-letter">${'ABCD'[oi]}</span>
              <input type="text" class="rule-editor-input" placeholder="選項 ${'ABCD'[oi]}"
                     value="${escapeHtml(opt)}"
                     onchange="updateQuestion('${quiz.id}','${q.id}','option${oi}',this.value)" />
            </label>`).join('')}
        </div>
        <div class="question-hint">✦ 點左側圓圈標記正確答案</div>
      ` : ''}

      ${q.type === 'truefalse' ? `
        <div class="option-list">
          <label class="option-row">
            <input type="radio" name="ans_${q.id}" ${q.answer === true ? 'checked' : ''}
                   onchange="updateQuestion('${quiz.id}','${q.id}','answer','true')" /> 正確 ○
          </label>
          <label class="option-row">
            <input type="radio" name="ans_${q.id}" ${q.answer === false ? 'checked' : ''}
                   onchange="updateQuestion('${quiz.id}','${q.id}','answer','false')" /> 錯誤 ✕
          </label>
        </div>
      ` : ''}

      ${q.type === 'short' ? `
        <input type="text" class="rule-editor-input" placeholder="正確答案(比對時會忽略大小寫與前後空白)"
               value="${escapeHtml(q.answer || '')}"
               onchange="updateQuestion('${quiz.id}','${q.id}','answer',this.value)" />
      ` : ''}
    </div>
  `).join('');

  return `<div class="quiz-editor">
    ${questions}
    <button class="btn btn-ghost btn-block btn-small" onclick="addQuestion('${quiz.id}')">＋ 新增題目</button>
  </div>`;
}

function renderQuizResults(quiz) {
  const rows = state.students
    .filter(s => s.quizResults && s.quizResults[quiz.id])
    .map(s => {
      const r = s.quizResults[quiz.id];
      const pct = r.total > 0 ? Math.round(r.score / r.total * 100) : 0;
      return `<tr>
        <td>${escapeHtml(s.seatNumber || '')}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${r.score}/${r.total}</td>
        <td>${pct}%</td>
        <td>+${r.awarded} 分</td>
      </tr>`;
    }).join('');

  if (!rows) {
    return `<div class="quiz-results-empty">尚未收回任何成績。學生交卷後,按上方「收回成績」結算。</div>`;
  }

  return `<div class="quiz-results">
    <table class="quiz-results-table">
      <thead><tr><th>座號</th><th>姓名</th><th>答對</th><th>正確率</th><th>獲得</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
