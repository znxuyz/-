/* ============================================
   Excel 匯入 - 使用 SheetJS (xlsx.js)
   需在 index.html 引入 SheetJS CDN
============================================ */

const ExcelImport = {
  
  // 觸發檔案選擇對話框
  pickFile(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          if (typeof XLSX === 'undefined') {
            toast('Excel 套件未載入,請檢查網路連線');
            return;
          }
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          // 取第一個工作表
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          callback(rows, file.name);
        } catch (err) {
          console.error(err);
          toast('讀取 Excel 失敗:' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  },
  
  // 解析學生名單 Excel
  // 期待格式:標題列 + 座號 / 姓名 / 守護獸(選填)
  parseStudentRows(rows) {
    if (!rows || rows.length < 2) {
      return { error: '檔案內容為空或缺少資料列' };
    }
    
    // 找出標題列(允許多種寫法)
    const header = rows[0].map(c => String(c || '').trim());
    const seatCol = header.findIndex(h => h.includes('座號') || /^(no|number|#)$/i.test(h));
    const nameCol = header.findIndex(h => h.includes('姓名') || h.includes('學生') || /^name$/i.test(h));
    const petCol = header.findIndex(h => h.includes('守護獸') || h.includes('寵物'));
    
    if (nameCol < 0) {
      return { error: '找不到「姓名」欄位。請確認首列包含「姓名」字樣' };
    }
    
    const validPets = PET_SPECIES.map(p => p.name);
    const petNameToId = {};
    PET_SPECIES.forEach(p => { petNameToId[p.name] = p.id; });
    
    const results = [];
    const errors = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row[nameCol] || '').trim();
      if (!name) continue; // 空列跳過
      
      const seat = seatCol >= 0 ? String(row[seatCol] || '').trim() : '';
      const petName = petCol >= 0 ? String(row[petCol] || '').trim() : '';
      
      const entry = { name, seatNumber: seat };
      if (petName) {
        if (petNameToId[petName]) {
          entry.pet = petNameToId[petName];
        } else {
          errors.push(`第 ${i + 1} 列「${name}」的守護獸「${petName}」無法識別,將略過`);
        }
      }
      results.push(entry);
    }
    
    return { students: results, warnings: errors };
  }
};

/* ============================================
   套用匯入學生 - 處理覆蓋/追加邏輯
============================================ */

function importStudentsFromExcel() {
  ExcelImport.pickFile((rows, filename) => {
    const result = ExcelImport.parseStudentRows(rows);
    if (result.error) {
      toast(result.error);
      return;
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.warn(result.warnings.join('\n'));
    }
    
    const imported = result.students;
    if (imported.length === 0) {
      toast('檔案中沒有任何學生資料');
      return;
    }
    
    // 詢問處理方式
    const mode = state.students.length > 0 ?
      confirm(`找到 ${imported.length} 位學生(來自 ${filename})。\n\n按「確定」= 完全覆蓋現有名單\n按「取消」= 合併追加(現有學生保留資料)`)
      : true;
    
    if (mode) {
      // 完全覆蓋
      state.students = imported.map((s, i) => {
        const stu = createStudent(s.name, i);
        if (s.seatNumber) stu.seatNumber = s.seatNumber;
        if (s.pet) stu.pet = s.pet;
        return stu;
      });
    } else {
      // 合併追加:依姓名保留現有
      const existing = new Map(state.students.map(s => [s.name, s]));
      let added = 0;
      imported.forEach((s, i) => {
        const exists = existing.get(s.name);
        if (exists) {
          // 更新座號與寵物(若 Excel 有指定)
          if (s.seatNumber) exists.seatNumber = s.seatNumber;
          if (s.pet && !exists.pet) exists.pet = s.pet;
        } else {
          const stu = createStudent(s.name, Date.now() + i);
          if (s.seatNumber) stu.seatNumber = s.seatNumber;
          if (s.pet) stu.pet = s.pet;
          state.students.push(stu);
          added++;
        }
      });
      toast('合併完成,新增 ' + added + ' 位學生');
    }
    
    // 依座號排序
    state.students.sort((a, b) => {
      const aN = parseInt(a.seatNumber) || 9999;
      const bN = parseInt(b.seatNumber) || 9999;
      return aN - bN;
    });
    
    save();
    
    // 如果在 setup 階段,直接進入主介面
    if (!state.className) {
      const cn = document.getElementById('setupClassName')?.value.trim() || '我的班級';
      const tn = document.getElementById('setupTeacherName')?.value.trim() || '老師';
      state.className = cn;
      state.teacherName = tn;
      state.rules = state.rules.length > 0 ? state.rules : [...DEFAULT_RULES];
      save();
      showApp();
    } else {
      renderAll();
    }
    
    toast(`✦ 已匯入 ${imported.length} 位學生`);
    
    if (result.warnings && result.warnings.length > 0) {
      setTimeout(() => {
        alert('注意事項:\n\n' + result.warnings.join('\n'));
      }, 1500);
    }
  });
}

/* ============================================
   下載範本提示 - 引導老師取得範本
============================================ */

function showImportTemplateHint() {
  alert(
    '學生資料 Excel 範本格式\n' +
    '────────────────\n\n' +
    '需要的欄位(首列為標題):\n' +
    '  座號 | 姓名 | 守護獸(選填)\n\n' +
    '說明:\n' +
    '• 「姓名」為必填欄位\n' +
    '• 「座號」會用於排序\n' +
    '• 「守護獸」可填台灣特有種名稱:\n' +
    '   台灣黑熊、石虎、櫻花鉤吻鮭、帝雉、\n' +
    '   台灣藍鵲、穿山甲、山羌、台灣獼猴\n\n' +
    '專案資料夾中有「學生資料範本.xlsx」可直接編輯使用。'
  );
}
