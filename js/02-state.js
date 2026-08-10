/* ============================================
   全域狀態
============================================ */
let state = {
  // 帳號與班級(雲端模式才有值)
  user: null,               // { uid, email, displayName, role }
  classId: null,            // 目前操作中的班級 id
  joinCode: null,           // 目前班級的加入代碼
  myClasses: [],            // 老師:所有班級清單 / 學生:所屬班級清單
  className: '',
  teacherName: '',
  students: [],
  rules: [...DEFAULT_RULES],
  selectedStudentId: null,
  pendingPetSelection: null,
  pendingPetSpecies: null,
  // 課堂工具相關
  attendance: {},
  currentAttendanceDate: null,
  pickerHistory: [],
  pickerLastResult: [],
  // 班級管理相關
  seatingLayouts: [],
  currentLayout: null,
  groupSets: [],
  currentGroups: [],
  groupMode: 'byCount',
  // 計時器
  timer: {
    seconds: 300,
    initialSeconds: 300,
    running: false,
    intervalId: null,
    fullscreen: false
  },
  // 聯絡簿
  contactBook: {},          // { 'YYYY-MM-DD': { classNote, teacherMessage, studentNotes: {} } }
  currentContactDate: null,
  // 作業
  homework: [],             // [{ id, name, description, assignedDate, dueDate, submissionPoints, submissions, archived }]
  // 班級任務
  classTasks: [],           // [{ id, name, description, target, reward, completed, completedAt, claimedAmount }]
  // 商店相關紀錄(個人庫存放在 student.inventory)
  shopHistory: [],          // [{ studentId, itemId, time, price }]
  // 作業測驗題庫
  quizzes: []               // [{ id, title, questions, status, dueDate, pointsPerQuestion }]
};
