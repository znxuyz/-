/* ============================================
   計時器
============================================ */
function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function setTimer(seconds) {
  pauseTimer();
  state.timer.seconds = seconds;
  state.timer.initialSeconds = seconds;
  updateTimerDisplay();
}

function setCustomTimer() {
  const min = parseInt(document.getElementById('customMinutes').value) || 0;
  const sec = parseInt(document.getElementById('customSeconds').value) || 0;
  const total = min * 60 + sec;
  if (total === 0) {
    toast('請輸入時間');
    return;
  }
  setTimer(total);
  toast('已設定 ' + formatTime(total));
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  display.textContent = formatTime(state.timer.seconds);
  
  display.classList.remove('warning', 'finished');
  if (state.timer.seconds === 0) {
    display.classList.add('finished');
    document.getElementById('timerLabel').textContent = '時間到!';
  } else if (state.timer.seconds <= 10 && state.timer.running) {
    display.classList.add('warning');
    document.getElementById('timerLabel').textContent = '即將結束';
  } else if (state.timer.running) {
    document.getElementById('timerLabel').textContent = '倒數中';
  } else {
    document.getElementById('timerLabel').textContent = '準備計時';
  }
  
  document.getElementById('timerToggleBtn').innerHTML =
    state.timer.running ? TIMER_ICON.pause : TIMER_ICON.play;
}

/* 播放三角形刻意往右挪一點點(7→20,中心 13.5 而非 12)。
   三角形的重心偏左,幾何置中反而看起來偏左,這是圖示的慣例做法。 */
const TIMER_ICON = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
           <path d="M7 4.5 20 12 7 19.5Z" />
         </svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="7" y="5" width="4" height="14" rx="1.2" />
            <rect x="13" y="5" width="4" height="14" rx="1.2" />
          </svg>`
};

function toggleTimer() {
  if (state.timer.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (state.timer.seconds === 0) {
    state.timer.seconds = state.timer.initialSeconds;
  }
  state.timer.running = true;
  state.timer.intervalId = setInterval(() => {
    state.timer.seconds--;
    updateTimerDisplay();
    if (state.timer.seconds === 0) {
      pauseTimer();
      playTimerSound();
      updateTimerDisplay();
    }
  }, 1000);
  updateTimerDisplay();
}

function pauseTimer() {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  state.timer.running = false;
  updateTimerDisplay();
}

function resetTimer() {
  pauseTimer();
  state.timer.seconds = state.timer.initialSeconds;
  updateTimerDisplay();
}

function addTimerMinute() {
  state.timer.seconds += 60;
  state.timer.initialSeconds += 60;
  updateTimerDisplay();
}

function playTimerSound() {
  // 用 Web Audio API 產生提示音
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 660, 880].forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }, i * 200);
    });
  } catch (e) { /* 靜默失敗 */ }
}

function toggleTimerFullscreen() {
  const stage = document.getElementById('timerStage');
  stage.classList.toggle('fullscreen');
  state.timer.fullscreen = stage.classList.contains('fullscreen');
}
