const KEY = 'vision-foot-state';
const ADMIN_AUTH_KEY = 'vision-foot-admin-auth';

const el = id => document.getElementById(id);
const home = el('home'), away = el('away');
const scoreHome = el('scoreHome'), scoreAway = el('scoreAway');
const status = el('status'), clock = el('clock'), extra = el('extra'), message = el('message');
const adminBtn = el('adminBtn'), login = el('login'), loginForm = el('loginForm');
const password = el('password'), error = el('error'), panel = el('panel'), closeBtn = el('close');
const homeIn = el('homeIn'), awayIn = el('awayIn');
const homeColor = el('homeColor'), homeOutline = el('homeOutline'), homeBg = el('homeBg');
const awayColor = el('awayColor'), awayOutline = el('awayOutline'), awayBg = el('awayBg');
const saveTeams = el('saveTeams'), homePlus = el('homePlus'), homeMinus = el('homeMinus');
const awayPlus = el('awayPlus'), awayMinus = el('awayMinus');
const startBtn = el('start'), stopBtn = el('stop'), resetBtn = el('reset');
const extraIn = el('extraIn'), saveExtra = el('saveExtra');
const scoreColor = el('scoreColor'), scoreBg = el('scoreBg'), clockColor = el('clockColor'), extraColor = el('extraColor');
const messageIn = el('messageIn'), saveMessage = el('saveMessage');
const removeScore = el('removeScore'), showScore = el('showScore');
const scoreSize = el('scoreSize'), scoreSizeValue = el('scoreSizeValue');
const moveScore = el('moveScore');
const scorePanel = el('score');

let state = {
  home: 'DJIBABOUYA', away: 'KANSIDI', sh: 0, sa: 0, status: 'DIRECT',
  extra: 0, message: '', running: false, elapsed: 0, startedAt: 0,
  extraMode: false, extraElapsed: 0, extraStartedAt: 0,
  homeColor: '#ffffff', homeOutline: '#000000', homeBg: '#0964e8',
  awayColor: '#ffffff', awayOutline: '#000000', awayBg: '#f4c400',
  scoreColor: '#111111', scoreBg: '#ffffff', clockColor: '#ffffff',
  extraColor: '#ffffff', scoreVisible: true, scoreScale: 100, scoreX: 0, scoreY: 108
};

let ws = null;
let serverReady = false;

function applyState(incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  state = { ...state, ...incoming };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  render();
}

async function loadState() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (!r.ok) throw new Error('state');
    const incoming = await r.json();
    applyState(incoming);
    serverReady = true;
  } catch (_) {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (saved && typeof saved === 'object') state = { ...state, ...saved };
    } catch (_) {}
    render();
  }
}

function connectRealtime() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  try {
    ws = new WebSocket(`${proto}//${location.host}/api/ws`);
    ws.onmessage = e => {
      try { applyState(JSON.parse(e.data)); } catch (_) {}
    };
    ws.onclose = () => setTimeout(connectRealtime, 1500);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  } catch (_) { setTimeout(connectRealtime, 1500); }
}

async function publishState() {
  try {
    const token = sessionStorage.getItem(ADMIN_AUTH_KEY) || '';
    const r = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(state)
    });
    if (!r.ok) {
      if (r.status === 401) {
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        alert('Session administrateur expirée. Reconnectez-vous.');
      }
      throw new Error('publish');
    }
    const incoming = await r.json();
    applyState(incoming);
    return true;
  } catch (e) {
    // Keep local UI usable, but do not pretend other phones are synchronized.
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    render();
    return false;
  }
}

function saveAndSync() { publishState(); }

function currentSeconds() {
  if (state.extraMode) {
    let seconds = Number(state.extraElapsed) || 0;
    if (state.running && state.extraStartedAt) seconds += Math.floor((Date.now() - state.extraStartedAt) / 1000);
    return seconds;
  }
  let seconds = Number(state.elapsed) || 0;
  if (state.running && state.startedAt) seconds += Math.floor((Date.now() - state.startedAt) / 1000);
  return seconds;
}
function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

function render() {
  home.textContent = state.home; away.textContent = state.away;
  scoreHome.textContent = state.sh; scoreAway.textContent = state.sa;
  status.textContent = state.status || 'DIRECT';
  const publishedExtra = Number(state.extra) || 0;
  extra.hidden = publishedExtra <= 0;
  extra.textContent = publishedExtra > 0 ? '+' + publishedExtra : '';
  message.textContent = state.message || '';

  home.style.color = state.homeColor;
  home.style.webkitTextStroke = `1px ${state.homeOutline}`;
  home.style.textShadow = `0 0 0 ${state.homeOutline}`;
  home.style.backgroundColor = state.homeBg || '#0964e8';
  away.style.color = state.awayColor;
  away.style.webkitTextStroke = `1px ${state.awayOutline}`;
  away.style.textShadow = `0 0 0 ${state.awayOutline}`;
  away.style.backgroundColor = state.awayBg || '#f4c400';
  scoreHome.style.color = state.scoreColor; scoreAway.style.color = state.scoreColor;
  document.querySelector('.score-box').style.backgroundColor = state.scoreBg || '#ffffff';
  clock.style.color = state.clockColor; extra.style.color = state.extraColor;
  scorePanel.classList.toggle('is-hidden', state.scoreVisible === false);
  const scale = Math.max(50, Math.min(150, Number(state.scoreScale) || 100));
  scorePanel.style.setProperty('--score-scale', scale / 100);
  scorePanel.style.left = (Number(state.scoreX) || 0) + 'px';
  scorePanel.style.top = (Number(state.scoreY) || 0) + 'px';
  if (scoreSize) scoreSize.value = scale;
  if (scoreSizeValue) scoreSizeValue.textContent = scale + '%';

  clock.textContent = formatTime(currentSeconds());
  if (state.extraMode && state.extra > 0) {
    const limit = Number(state.extra) * 60;
    if (currentSeconds() >= limit && state.running) {
      state.extraElapsed = limit; state.running = false; state.extraStartedAt = 0;
      publishState(); clock.textContent = formatTime(limit);
    }
  }
}

function openAdminPanel() {
  if (panel.open) return;
  homeIn.value = state.home; awayIn.value = state.away;
  homeColor.value = state.homeColor || '#ffffff'; homeOutline.value = state.homeOutline || '#000000';
  homeBg.value = state.homeBg || '#0964e8'; awayColor.value = state.awayColor || '#ffffff';
  awayOutline.value = state.awayOutline || '#000000'; awayBg.value = state.awayBg || '#f4c400';
  scoreColor.value = state.scoreColor || '#111111'; scoreBg.value = state.scoreBg || '#ffffff';
  clockColor.value = state.clockColor || '#ffffff'; extraColor.value = state.extraColor || '#ffffff';
  extraIn.value = state.extra || ''; messageIn.value = state.message || '';
  panel.show();
}
function closeAdminPanel() { if (panel.open) panel.close(); }
function isAdminAuthenticated() { return !!sessionStorage.getItem(ADMIN_AUTH_KEY); }
async function openAdminLogin() {
  if (panel.open || login.open) return;
  if (isAdminAuthenticated()) { openAdminPanel(); return; }
  login.showModal(); password.focus();
}
adminBtn.addEventListener('click', openAdminLogin);
closeBtn.addEventListener('click', closeAdminPanel);

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const r = await fetch('/api/login', {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({ password: password.value })
    });
    const data = await r.json();
    if (!r.ok || !data.token) throw new Error();
    sessionStorage.setItem(ADMIN_AUTH_KEY, data.token);
    error.textContent = ''; password.value = ''; login.close(); openAdminPanel();
  } catch (_) { error.textContent = 'Mot de passe incorrect'; }
});

saveTeams.addEventListener('click', () => {
  Object.assign(state, {
    home: homeIn.value.trim() || state.home, away: awayIn.value.trim() || state.away,
    homeColor: homeColor.value, homeOutline: homeOutline.value, homeBg: homeBg.value,
    awayColor: awayColor.value, awayOutline: awayOutline.value, awayBg: awayBg.value,
    scoreColor: scoreColor.value, scoreBg: scoreBg.value, clockColor: clockColor.value, extraColor: extraColor.value
  });
  saveAndSync(); render();
});
homePlus.addEventListener('click', () => { state.sh++; saveAndSync(); render(); });
homeMinus.addEventListener('click', () => { state.sh = Math.max(0, state.sh - 1); saveAndSync(); render(); });
awayPlus.addEventListener('click', () => { state.sa++; saveAndSync(); render(); });
awayMinus.addEventListener('click', () => { state.sa = Math.max(0, state.sa - 1); saveAndSync(); render(); });

startBtn.addEventListener('click', () => {
  if (state.running) return;
  state.running = true;
  if (state.extraMode) state.extraStartedAt = Date.now(); else state.startedAt = Date.now();
  saveAndSync(); render();
});
stopBtn.addEventListener('click', () => {
  if (!state.running) return;
  if (state.extraMode) { state.extraElapsed += Math.floor((Date.now() - state.extraStartedAt) / 1000); state.extraStartedAt = 0; }
  else { state.elapsed += Math.floor((Date.now() - state.startedAt) / 1000); state.startedAt = 0; }
  state.running = false; saveAndSync(); render();
});
resetBtn.addEventListener('click', () => {
  state.running = false; state.elapsed = 0; state.startedAt = 0;
  state.extraMode = false; state.extraElapsed = 0; state.extraStartedAt = 0;
  saveAndSync(); render();
});
saveExtra.addEventListener('click', () => {
  const minutes = Math.max(0, Math.min(99, Number(extraIn.value || 0)));
  state.extra = minutes;
  if (minutes > 0) {
    state.extraMode = true; state.extraElapsed = 0; state.extraStartedAt = Date.now();
    state.elapsed = 0; state.startedAt = 0; state.running = true;
  } else {
    state.extraMode = false; state.extraElapsed = 0; state.extraStartedAt = 0;
    state.elapsed = 0; state.startedAt = 0; state.running = false;
  }
  saveAndSync(); render();
});
saveMessage.addEventListener('click', () => { state.message = messageIn.value; saveAndSync(); render(); });
removeScore.addEventListener('click', () => { state.scoreVisible = false; saveAndSync(); render(); });
showScore.addEventListener('click', () => { state.scoreVisible = true; saveAndSync(); render(); });
scoreSize.addEventListener('input', () => {
  state.scoreScale = Math.max(50, Math.min(150, Number(scoreSize.value) || 100)); render();
});
scoreSize.addEventListener('change', () => { saveAndSync(); render(); });

panel.addEventListener('click', e => { if (e.target === panel) closeAdminPanel(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.open) closeAdminPanel(); });

if (window.Twitch && el('twitch')) {
  new Twitch.Embed('twitch', {
    width: '100%', height: '100%', channel: 'mariamadabo', layout: 'video', parent: [location.hostname]
  });
}

setInterval(render, 1000);
loadState();
connectRealtime();

// Déplacement libre de l'affichage TV.
let movingScore = false, dragPointerId = null, dragOffsetX = 0, dragOffsetY = 0;
function clampScorePosition(x, y) {
  const rect = scorePanel.getBoundingClientRect();
  const width = rect.width || scorePanel.offsetWidth || window.innerWidth;
  const height = rect.height || scorePanel.offsetHeight || 73;
  return {
    x: Math.max(0, Math.min(window.innerWidth - Math.min(width, window.innerWidth), x)),
    y: Math.max(0, Math.min(window.innerHeight - Math.min(height, window.innerHeight), y))
  };
}
function setMoveMode(enabled) {
  movingScore = enabled; scorePanel.classList.toggle('move-mode', enabled);
  moveScore.textContent = enabled ? 'TERMINER LE DÉPLACEMENT' : 'DÉPLACER L’AFFICHAGE';
  moveScore.style.background = enabled ? '#c62828' : '#2452e8';
}
moveScore.addEventListener('click', () => setMoveMode(!movingScore));
function pointerStart(e) {
  if (!movingScore) return;
  dragPointerId = e.pointerId;
  dragOffsetX = e.clientX - (Number(state.scoreX) || 0);
  dragOffsetY = e.clientY - (Number(state.scoreY) || 0);
  scorePanel.setPointerCapture?.(e.pointerId); e.preventDefault();
}
function pointerMove(e) {
  if (!movingScore || dragPointerId !== e.pointerId) return;
  const pos = clampScorePosition(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
  state.scoreX = pos.x; state.scoreY = pos.y; render(); e.preventDefault();
}
function pointerEnd(e) {
  if (dragPointerId !== e.pointerId) return;
  dragPointerId = null; saveAndSync(); render();
}
scorePanel.addEventListener('pointerdown', pointerStart);
scorePanel.addEventListener('pointermove', pointerMove);
scorePanel.addEventListener('pointerup', pointerEnd);
scorePanel.addEventListener('pointercancel', pointerEnd);
window.addEventListener('resize', () => {
  if (!movingScore) return;
  const pos = clampScorePosition(Number(state.scoreX) || 0, Number(state.scoreY) || 0);
  state.scoreX = pos.x; state.scoreY = pos.y; saveAndSync(); render();
});
