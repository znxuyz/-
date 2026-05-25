/* ============================================
   全域狀態
============================================ */
let state = {
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
  shopHistory: []           // [{ studentId, itemId, time, price }]
};
