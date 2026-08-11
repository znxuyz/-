/* ============================================
   渲染:投影模式
============================================ */
function renderProjector() {
  const grid = document.getElementById('projectorGrid');
  const totalEl = document.getElementById('projTotalPoints');
  
  const total = state.students.reduce((sum, s) => sum + s.totalPoints, 0);
  totalEl.textContent = '總積分 ' + total;
  
  grid.innerHTML = state.students.map(student => {
    const stage = student.pet ? PetEngine.getStage(student.totalPoints) : 0;
    const health = PetEngine.getHealth(student);
    const icon = student.pet ? PetEngine.getIcon(student) : '❓';
    const species = student.pet ? PET_SPECIES.find(p => p.id === student.pet) : null;
    const petLabel = student.petName ? '「' + student.petName + '」' : (species ? STAGE_NAMES[stage] : '尚未選擇');
    
    return `
      <div class="projector-card" data-student-id="${student.id}">
        <div class="projector-pet stage-${stage} health-${health}">
          ${icon}
        </div>
        <div class="projector-name">${student.name}</div>
        <div class="projector-pet-name">${petLabel}</div>
        <div class="projector-points">${student.totalPoints}</div>
      </div>
    `;
  }).join('');
}

function triggerProjectorFlash(studentId, points) {
  const card = document.querySelector(`.projector-card[data-student-id="${studentId}"]`);
  if (!card) return;
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
  
  // 漂浮分數
  const rect = card.getBoundingClientRect();
  const float = document.createElement('div');
  float.className = 'float-points';
  float.textContent = (points > 0 ? '+' : '') + points;
  float.style.color = points > 0 ? 'var(--gold)' : 'var(--sick)';
  float.style.left = (rect.left + rect.width / 2) + 'px';
  float.style.top = (rect.top + 20) + 'px';
  document.body.appendChild(float);
  setTimeout(() => float.remove(), 1500);
}
