/* ============================================
   儲存模組 - 抽換為 Firebase 時只需替換此模組
============================================ */
const Storage = {
  KEY: 'guardian-classroom-v1',
  
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Load failed:', e);
      return null;
    }
  },
  
  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  },
  
  clear() {
    localStorage.removeItem(this.KEY);
  }
};


/* ============================================
   儲存 - 將整個 state 寫入 localStorage
   未來抽換為 Firebase 雲端只需改這個函式
============================================ */

function save() {
  Storage.save({
    className: state.className,
    teacherName: state.teacherName,
    students: state.students,
    rules: state.rules,
    attendance: state.attendance,
    seatingLayouts: state.seatingLayouts,
    groupSets: state.groupSets,
    contactBook: state.contactBook,
    homework: state.homework,
    classTasks: state.classTasks,
    shopHistory: state.shopHistory
  });
}
