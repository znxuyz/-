/* ============================================
   積分規則編輯
============================================ */
function renderRulesEditor() {
  const editor = document.getElementById('rulesEditor');
  editor.innerHTML = state.rules.map((rule, i) => `
    <div class="rule-editor-row">
      <input type="text" class="rule-editor-input" value="${rule.name}" 
        onchange="updateRule(${i}, 'name', this.value)" placeholder="規則名稱" />
      <input type="number" class="rule-editor-input" value="${rule.points}" 
        onchange="updateRule(${i}, 'points', parseInt(this.value))" placeholder="分數" />
      <button class="icon-btn" onclick="deleteRule(${i})">✕</button>
    </div>
  `).join('');
}

function addRule() {
  state.rules.push({ name: '新規則', points: 1 });
  save();
  renderRulesEditor();
  renderRuleGrid();
}

function updateRule(i, field, value) {
  state.rules[i][field] = value;
  save();
  renderRuleGrid();
}

function deleteRule(i) {
  if (!confirm('確定刪除這條規則?')) return;
  state.rules.splice(i, 1);
  save();
  renderRulesEditor();
  renderRuleGrid();
}
