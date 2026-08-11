/* ============================================
   初始化
============================================ */
function showSetup() {
  hideAllTopViews();
  document.getElementById('setupView').classList.remove('hidden');
}

function showApp() {
  hideAllTopViews();
  document.getElementById('appView').classList.remove('hidden');
  renderClassSwitcher();
  renderAll();
}

function completeSetup() {
  const className = document.getElementById('setupClassName').value.trim();
  const teacherName = document.getElementById('setupTeacherName').value.trim();
  const studentsText = document.getElementById('setupStudents').value.trim();
  
  if (!className || !teacherName || !studentsText) {
    toast('請填寫所有欄位');
    return;
  }
  
  const names = studentsText.split('\n').map(s => s.trim()).filter(s => s);
  if (names.length === 0) {
    toast('請至少輸入一位學生');
    return;
  }
  
  state.className = className;
  state.teacherName = teacherName;
  state.students = names.map((name, i) => createStudent(name, i));
  state.rules = [...DEFAULT_RULES];
  
  save();
  showApp();
}

function createStudent(name, index) {
  return {
    id: 'st_' + Date.now() + '_' + index,
    name: name,
    seatNumber: '',        // 座號(可用 Excel 匯入或設定頁修改)
    email: '',             // Google 帳號,學生自行登入用
    pet: null,
    petName: null,
    totalPoints: 0,
    currentPoints: 0,
    lastPointTime: null,
    history: [],
    inventory: [],
    createdAt: Date.now()
  };
}

/* 確保舊資料具備新欄位(向後相容) */
function migrateStudent(s) {
  if (!s.inventory) s.inventory = [];
  if (s.currentPoints === undefined) s.currentPoints = s.totalPoints || 0;
  if (s.seatNumber === undefined) s.seatNumber = '';
  if (s.email === undefined) s.email = '';
  if (!s.quizResults) s.quizResults = {};   // { quizId: { score, total, awarded, at } }
  return s;
}

/* ============================================
   示範資料(研習用)
============================================ */
function loadDemoData() {
  const demoNames = [
    '王小明', '陳美麗', '林志強', '黃雅婷', '張俊宇', '李欣怡',
    '吳建宏', '蔡佳穎', '劉冠廷', '楊雨晴', '鄭凱倫', '謝宜君',
    '許志豪', '何思妤', '羅文傑', '高敏華', '林品妍', '蕭立群',
    '簡淑芬', '盧建成', '范芷瑩', '徐國豪', '傅怡君', '葉信宏',
    '邱秉翰', '潘巧雯', '彭家瑋', '曾雅琪'
  ];
  
  state.className = '四年二班';
  state.teacherName = '張老師';
  state.rules = [...DEFAULT_RULES];
  
  const petIds = PET_SPECIES.map(p => p.id);
  const now = Date.now();
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  
  state.students = demoNames.map((name, i) => {
    const pet = petIds[Math.floor(Math.random() * petIds.length)];
    const basePoints = Math.floor(Math.random() * 180);
    const daysSinceLast = Math.floor(Math.random() * 12);
    const lastPointTime = now - daysSinceLast * 24 * 60 * 60 * 1000;
    
    return {
      id: 'st_' + (now - TWO_WEEKS) + '_' + i,
      name,
      pet,
      petName: null,
      totalPoints: basePoints,
      currentPoints: Math.max(0, basePoints - Math.floor(Math.random() * 30)),
      lastPointTime: basePoints > 0 ? lastPointTime : null,
      history: basePoints > 0 ? [
        { time: lastPointTime, points: 2, reason: '完成作業' }
      ] : [],
      inventory: [],
      createdAt: now - TWO_WEEKS
    };
  });
  
  // 示範作業
  state.homework = [
    {
      id: 'hw_demo_1',
      name: '國語第三課習作',
      description: '完成課本 P.42-43,標注生字部首',
      assignedDate: getTodayDate(),
      dueDate: getTodayDate(),
      submissionPoints: 2,
      submissions: {},
      archived: false
    },
    {
      id: 'hw_demo_2',
      name: '數學練習題',
      description: '習作 P.18-19 應用題',
      assignedDate: getTodayDate(),
      dueDate: getTodayDate(),
      submissionPoints: 2,
      submissions: {},
      archived: false
    }
  ];
  
  // 示範班級任務
  state.classTasks = [
    {
      id: 'task_demo_1',
      name: '全班守護獸大聚會',
      description: '當全班累積總積分達到 3000 分時,全班可享一節電影課',
      target: 3000,
      reward: '一節班級電影時光',
      completed: false,
      completedAt: null,
      createdAt: now
    },
    {
      id: 'task_demo_2',
      name: '十位守護神獸誕生',
      description: '當全班有 10 位學生的守護獸達到「神獸」階段',
      target: 10,
      type: 'legendCount',
      reward: '校外教學優先地點選擇權',
      completed: false,
      completedAt: null,
      createdAt: now
    }
  ];
  
  save();
  showApp();
  toast('示範資料已載入,共 ' + demoNames.length + ' 位學生');
}
