// ════════════════════════════════════════════════════════════
//  AQUA SENTINEL — app.js
//  Logic bersama: Auth, Firebase init, EWS engine, notifikasi.
//  Dipakai di semua halaman (dashboard, history, prediction, settings).
// ════════════════════════════════════════════════════════════

const { FIREBASE_CONFIG, PATHS, FIELD_MAP, DEFAULT_THRESHOLDS, EWS_CONFIG } = window.AQUA_CONFIG;

if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const rtdb = firebase.database();

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3000);
}

// ── Offline detection ────────────────────────────────────────
window.addEventListener('load', () => {
  const bar = document.getElementById('offlineBar');
  if (!bar) return;
  window.addEventListener('offline', () => bar.classList.add('show'));
  window.addEventListener('online',  () => bar.classList.remove('show'));
  if (!navigator.onLine) bar.classList.add('show');
});

// ── Service worker (PWA) ─────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ════════════════════════════════════════════════════════════
//  AUTH GUARD
// ════════════════════════════════════════════════════════════
let currentUser = null;

auth.onAuthStateChanged(user => {
  if (!user) {
    if (!location.pathname.endsWith('login.html')) {
      window.location.replace('./login.html');
    }
    return;
  }
  currentUser = user;
  const badge = document.getElementById('userBadge');
  if (badge) badge.textContent = '👤 ' + (user.displayName || user.email.split('@')[0]);

  const gate = document.getElementById('authGate');
  if (gate) gate.style.display = 'none';
  document.body.classList.remove('hidden');

  // Mulai engine bersama setelah login terkonfirmasi
  startThresholdListener();
  startLiveSensorListener();

  // Hook halaman-spesifik (didefinisikan di file page masing-masing)
  if (typeof onAuthReady === 'function') onAuthReady(user);
});

function doLogout() {
  if (!confirm('Keluar dari akun ini?')) return;
  auth.signOut().then(() => window.location.replace('./login.html'));
}

// ════════════════════════════════════════════════════════════
//  THRESHOLDS (shared state)
// ════════════════════════════════════════════════════════════
window.currentThresholds = JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));

function startThresholdListener() {
  rtdb.ref(PATHS.thresholds).on('value', snap => {
    const val = snap.val();
    if (val) {
      window.currentThresholds = val;
    } else {
      // Belum ada di Firebase -> isi dengan default sekali
      rtdb.ref(PATHS.thresholds).set(DEFAULT_THRESHOLDS).catch(() => {});
      window.currentThresholds = JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));
    }
    if (typeof onThresholdsUpdated === 'function') onThresholdsUpdated(window.currentThresholds);
  }, err => console.error('Threshold listener error:', err));
}

// Hitung status (normal/warn/danger/offline) untuk satu parameter
function evaluateStatus(param, value) {
  if (value === null || value === undefined || isNaN(value)) return 'offline';
  const t = window.currentThresholds[param];
  if (!t) return 'normal';
  if (value < t.danger_min || value > t.danger_max) return 'danger';
  if (value < t.min || value > t.max) return 'warn';
  return 'normal';
}

function statusLabel(status) {
  return { normal: 'NORMAL', warn: 'WASPADA', danger: 'BAHAYA', offline: 'OFFLINE' }[status] || '—';
}

// ════════════════════════════════════════════════════════════
//  LIVE SENSOR (shared state + EWS reactive check)
// ════════════════════════════════════════════════════════════
window.latestSensor = null;
window.lastSensorAt = null;

function startLiveSensorListener() {
  rtdb.ref(PATHS.liveSensor).on('value', snap => {
    const val = snap.val();
    window.latestSensor = val;
    window.lastSensorAt = Date.now();
    if (typeof onLiveSensorUpdate === 'function') onLiveSensorUpdate(val);
    runReactiveEWS(val);
  }, err => console.error('Sensor listener error:', err));
}

function isSensorOffline() {
  if (!window.lastSensorAt) return true;
  const minutesSince = (Date.now() - window.lastSensorAt) / 60000;
  return minutesSince > EWS_CONFIG.sensorOfflineMinutes;
}

// ════════════════════════════════════════════════════════════
//  EARLY WARNING SYSTEM ENGINE
// ════════════════════════════════════════════════════════════
let lastAlertKey = null; // hindari notifikasi berulang untuk kondisi sama

function runReactiveEWS(sensorVal) {
  if (!sensorVal) return;
  const ph = Number(sensorVal[FIELD_MAP.ph]);
  const phStatus = evaluateStatus('ph', ph);

  if (phStatus === 'warn' || phStatus === 'danger') {
    const key = `reactive_${phStatus}_${Math.floor(ph * 10)}`;
    if (key !== lastAlertKey) {
      lastAlertKey = key;
      fireEWSAlert({
        type: phStatus === 'danger' ? 'danger' : 'warn',
        title: phStatus === 'danger' ? '🚨 BAHAYA: pH Kritis!' : '⚠️ Waspada: pH Tidak Normal',
        message: `pH air saat ini ${ph.toFixed(2)} — ${phStatus === 'danger' ? 'di luar batas aman, tindakan segera diperlukan' : 'mendekati batas tidak aman'}.`,
        source: 'reactive'
      });
    }
  } else {
    lastAlertKey = null;
  }
}

let lastPredictiveAlertKey = null;

function runPredictiveEWS(forecast) {
  // forecast: { predicted_ph, hours_ahead, willBreach, breachType }
  if (!forecast || !forecast.willBreach) { lastPredictiveAlertKey = null; return; }
  const key = `predictive_${forecast.breachType}_${forecast.hours_ahead}`;
  if (key === lastPredictiveAlertKey) return;
  lastPredictiveAlertKey = key;

  fireEWSAlert({
    type: forecast.breachType === 'danger' ? 'danger' : 'warn',
    title: '🔮 Peringatan Dini: Tren pH Menurun/Naik',
    message: `Prediksi pH akan mencapai ${forecast.predicted_ph.toFixed(2)} dalam ±${forecast.hours_ahead} jam — berpotensi melewati ambang aman. Lakukan pengecekan & tindakan preventif.`,
    source: 'predictive'
  });
}

function fireEWSAlert({ type, title, message, source }) {
  // Simpan ke log Firebase
  rtdb.ref(PATHS.alertLog).push({
    type, title, message, source,
    timestamp: Date.now()
  }).catch(err => console.error('Gagal simpan alert log:', err));

  // Browser notification
  if (Notification.permission === 'granted') {
    new Notification(title, { body: message });
  }

  // Toast in-app
  showToast((type === 'danger' ? '🚨 ' : '⚠️ ') + message, type === 'danger');

  // Banner di halaman (kalau ada elemen-nya)
  showEWSBanner(type, title, message);
}

function showEWSBanner(type, title, message) {
  const banner = document.getElementById('ewsBanner');
  if (!banner) return;
  banner.className = 'ews-banner show ' + type;
  banner.innerHTML = `
    <div class="eb-icon">${type === 'danger' ? '🚨' : '⚠️'}</div>
    <div>
      <div class="eb-title">${title}</div>
      <div class="eb-desc">${message}</div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
//  NOTIFICATION BELL
// ════════════════════════════════════════════════════════════
function updateBellUI() {
  const btn = document.getElementById('bellBtn');
  if (!btn) return;
  if (Notification.permission === 'granted') {
    btn.innerHTML = '🔔'; btn.className = 'bell-btn bell-on'; btn.title = 'Notifikasi EWS aktif';
  } else {
    btn.innerHTML = '🔕'; btn.className = 'bell-btn bell-off'; btn.title = 'Aktifkan notifikasi peringatan dini';
  }
}
function requestNotif() {
  if (!('Notification' in window)) return showToast('⚠️ Browser tidak mendukung notifikasi.', true);
  if (Notification.permission === 'granted') return showToast('🔔 Notifikasi sudah aktif!');
  Notification.requestPermission().then(perm => {
    updateBellUI();
    if (perm === 'granted') {
      showToast('✅ Notifikasi EWS diaktifkan!');
      new Notification('🔔 Aqua Sentinel', { body: 'Kamu akan menerima peringatan dini kualitas air kolam.' });
    } else {
      showToast('⚠️ Izin notifikasi ditolak.', true);
    }
  });
}
document.addEventListener('DOMContentLoaded', updateBellUI);

// ── Util ──────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
function timeAgo(ts) {
  if (!ts) return '—';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec} detik lalu`;
  if (sec < 3600) return `${Math.floor(sec/60)} menit lalu`;
  if (sec < 86400) return `${Math.floor(sec/3600)} jam lalu`;
  return `${Math.floor(sec/86400)} hari lalu`;
}
