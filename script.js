// ============================================================
//  STRONG DAILY FLOW — script.js
//  Firebase Auth + Firestore + PWA Offline
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAcnTpDBXO2WpXs3ri21SXJfzUMC_xkCkU",
  authDomain: "premium-todo-list.firebaseapp.com",
  projectId: "premium-todo-list",
  storageBucket: "premium-todo-list.appspot.com",
  messagingSenderId: "630693485104",
  appId: "1:630693485104:web:820a99e6af935a7345abf5"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// Enable offline persistence (data tetap bisa dibaca saat offline)
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      console.warn('Offline persistence: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Offline persistence not supported by browser');
    }
  });

// ── Service Worker (PWA) ─────────────────────────────────────
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW failed:', err));
  });
}
*/
// ── Offline detection ────────────────────────────────────────
const offlineBar = document.getElementById('offlineBar');
window.addEventListener('offline', () => offlineBar.classList.add('show'));
window.addEventListener('online',  () => offlineBar.classList.remove('show'));
if (!navigator.onLine) offlineBar.classList.add('show');

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 2800);
}

// ── Tanggal hari ini ─────────────────────────────────────────
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const dateKey = getTodayDateString();

// ============================================================
//  AUTH GUARD — cek login, redirect ke login.html kalau belum
// ============================================================
let currentUser = null;
let scheduleUnsubscribe = null;

auth.onAuthStateChanged(user => {
  if (!user) {
    // Belum login → redirect ke halaman login
    window.location.replace('./login.html');
    return;
  }

  currentUser = user;

  // Tampilkan username di header
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('userBadge').textContent = '👤 ' + name;

  // Sembunyikan auth gate & tampilkan app
  document.getElementById('authGate').style.display = 'none';
  document.body.classList.remove('hidden');

  // Mulai listeners Firestore
  startScheduleListener();
  startProgressListeners();
});

function doLogout() {
  if (!confirm('Keluar dari akun ini?')) return;
  // Hentikan listeners
  if (scheduleUnsubscribe) scheduleUnsubscribe();
  auth.signOut().then(() => {
    window.location.replace('./login.html');
  });
}

// ============================================================
//  1. NAVIGASI
// ============================================================
function switchTab(tabId, btnEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${tabId}`).classList.add('active');
  btnEl.classList.add('active');
}

// ============================================================
//  2. PAGE 3 — ACCORDION PROGRAM LATIHAN
// ============================================================
function toggleDay(dayId) {
  const content = document.getElementById(`day-${dayId}`);
  const btn     = document.getElementById(`btn-${dayId}`);
  const isOpen  = content.classList.contains('open');
  document.querySelectorAll('.day-content').forEach(c => c.classList.remove('open'));
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('open'));
  if (!isOpen) { content.classList.add('open'); btn.classList.add('open'); }
}

// ============================================================
//  3. PAGE 1 — JADWAL HARIAN
// ============================================================
let mySchedule   = [];
let scheduleLoaded = false;

function renderSchedule() {
  const container = document.getElementById('scheduleList');
  if (mySchedule.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="ei">📋</div>
        <p>Belum ada jadwal hari ini.</p>
        <p style="margin-top:4px;">Tambah rutinitas di form di atas.</p>
      </div>`;
    updateProgressBar(0, 0);
    return;
  }
  mySchedule.sort((a, b) => a.time.localeCompare(b.time));
  container.innerHTML = '';
  mySchedule.forEach(item => {
    const done = item.completed || false;
    const div  = document.createElement('div');
    div.className = `task-card${done ? ' completed' : ''}`;
    div.innerHTML = `
      <input type="checkbox" ${done ? 'checked' : ''}
        onchange="toggleCheck('${item.id}', ${done})">
      <div class="task-info" onclick="toggleCheck('${item.id}', ${done})">
        <h4>${escHtml(item.title)}</h4>
        <p>${escHtml(item.desc || 'Tidak ada catatan tambahan')}</p>
      </div>
      <span class="task-time-badge">${escHtml(item.time)}</span>
      <button class="delete-btn" onclick="deleteSchedule('${item.id}')" title="Hapus">🗑</button>
    `;
    container.appendChild(div);
  });
  const done = mySchedule.filter(i => i.completed).length;
  updateProgressBar(done, mySchedule.length);
}

function updateProgressBar(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    total === 0 ? 'Belum ada jadwal' : `${done} / ${total} selesai`;
  document.getElementById('progressPct').textContent = pct + '%';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addNewSchedule() {
  const time  = document.getElementById('newTime').value;
  const title = document.getElementById('newTitle').value.trim();
  const desc  = document.getElementById('newDesc').value.trim();
  if (!time)  return showToast('⚠️ Jam wajib diisi!', true);
  if (!title) return showToast('⚠️ Nama jadwal wajib diisi!', true);

  const btn = document.getElementById('addBtn');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  db.collection('daily_routines').add({
    date: dateKey, time, title, desc, completed: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById('newTime').value  = '';
    document.getElementById('newTitle').value = '';
    document.getElementById('newDesc').value  = '';
    showToast('✅ Jadwal berhasil ditambahkan!');
  }).catch(err => {
    showToast('❌ Gagal: ' + err.message, true);
  }).finally(() => {
    btn.disabled = false;
    btn.textContent = '+ MASUKKAN KE DAFTAR';
  });
}

function toggleCheck(docId, currentStatus) {
  db.collection('daily_routines').doc(docId)
    .update({ completed: !currentStatus })
    .catch(err => showToast('❌ ' + err.message, true));
}

function deleteSchedule(docId) {
  if (!confirm('Hapus jadwal ini?')) return;
  db.collection('daily_routines').doc(docId).delete()
    .then(() => showToast('🗑 Jadwal dihapus.'))
    .catch(err => showToast('❌ ' + err.message, true));
}

function injectDefaultTemplate() {
  const defaults = [
    { time:'07:00', title:'🍳 Sarapan Ringan',            desc:'1 Centong Nasi + 2 Butir Telur' },
    { time:'10:00', title:'🥛 Snack Pagi',                desc:'1 Gelas Susu Milo + Roti Tawar' },
    { time:'13:00', title:'🍛 Makan Siang',               desc:'1.5 Centong Nasi + Dada Ayam + Sayur' },
    { time:'16:00', title:'⚡ Pre-Workout Snack',         desc:'1 Gelas Susu Pemicu Energi' },
    { time:'16:30', title:'🏋️ Sesi Workout Latihan Otot', desc:'Lihat panduan gerakan di menu Program' },
    { time:'19:00', title:'🍗 Makan Malam Kalori Booster',desc:'1.5 Centong Nasi + Telur/Daging' },
  ];
  const batch = db.batch();
  defaults.forEach(t => {
    const ref = db.collection('daily_routines').doc();
    batch.set(ref, { date: dateKey, ...t, completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
  batch.commit()
    .then(() => showToast('📋 Template jadwal harian dimuat!'))
    .catch(err => console.error('Template error:', err));
}

function startScheduleListener() {
  scheduleUnsubscribe = db.collection('daily_routines')
    .where('date', '==', dateKey)
    .orderBy('time')
    .onSnapshot(snapshot => {
      mySchedule = [];
      snapshot.forEach(doc => mySchedule.push({ id: doc.id, ...doc.data() }));

      if (!scheduleLoaded) {
        scheduleLoaded = true;
        if (mySchedule.length === 0) {
          injectDefaultTemplate();
          return;
        }
      }
      renderSchedule();
    }, err => {
      console.error('Schedule listener error:', err);
      // Coba tanpa orderBy (kalau index belum dibuat)
      db.collection('daily_routines')
        .where('date', '==', dateKey)
        .onSnapshot(snapshot => {
          mySchedule = [];
          snapshot.forEach(doc => mySchedule.push({ id: doc.id, ...doc.data() }));
          if (!scheduleLoaded) {
            scheduleLoaded = true;
            if (mySchedule.length === 0) { injectDefaultTemplate(); return; }
          }
          renderSchedule();
        }, err2 => {
          document.getElementById('scheduleList').innerHTML = `
            <div class="empty-state">
              <div class="ei">⚠️</div>
              <p>Gagal memuat: ${err2.message}</p>
              <p style="margin-top:4px;">Cek Firebase Rules & Indexes.</p>
            </div>`;
        });
    });
}

// ============================================================
//  4. PAGE 2 — PROGRESS (Berat Badan & Foto)
// ============================================================
function startProgressListeners() {
  // Berat badan
  db.collection('fitness_metrics').doc('weight_latest')
    .onSnapshot(doc => {
      document.getElementById('weightLoading').style.display = 'none';
      if (doc.exists && doc.data().current) {
        const d = doc.data();
        document.getElementById('weightInput').value = d.current || '';
        document.getElementById('goalInput').value   = d.target  || '';
        const wd = document.getElementById('weightDisplay');
        wd.style.display = 'block';
        document.getElementById('wdCurrent').textContent = `${d.current} kg`;
        document.getElementById('wdTarget').textContent  = `Target: ${d.target || '—'} kg`;
      }
    }, err => {
      document.getElementById('weightLoading').innerHTML =
        `<p style="color:var(--red);font-size:12px;">Gagal: ${err.message}</p>`;
    });

  // Foto progres
  db.collection('fitness_metrics').doc('photo_latest')
    .onSnapshot(doc => {
      if (doc.exists && doc.data().base64Data) {
        showPhotoPreview(doc.data().base64Data);
      }
    }, err => console.error('Foto load error:', err));
}

function saveWeightCloud() {
  const cw = document.getElementById('weightInput').value;
  const tw = document.getElementById('goalInput').value;
  if (!cw || !tw) return showToast('⚠️ Isi berat sekarang & target!', true);
  db.collection('fitness_metrics').doc('weight_latest').set({
    current: cw, target: tw,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => showToast('✅ Berat badan tersinkronisasi!'))
    .catch(err => showToast('❌ Gagal sync: ' + err.message, true));
}

function showPhotoPreview(base64) {
  const img = document.getElementById('photoDisplay');
  img.src = base64;
  img.style.display = 'block';
  document.getElementById('photoPlaceholder').style.display = 'none';
  document.getElementById('photoContainer').style.border = 'none';
}

function uploadPhotoCloud(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById('photoUploadStatus');
  status.textContent = '⏳ Mengompres & mengunggah...';
  status.style.color = 'var(--text-dim)';

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 500;
      const scale = img.width > MAX ? MAX / img.width : 1;
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.72);

      showPhotoPreview(compressed);

      db.collection('fitness_metrics').doc('photo_latest').set({
        base64Data: compressed,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        status.textContent = '✅ Foto tersinkronisasi ke semua perangkat!';
        status.style.color = 'var(--green)';
        showToast('📸 Foto progres diperbarui!');
        setTimeout(() => { status.textContent = ''; }, 3000);
      }).catch(err => {
        status.textContent = '❌ Gagal upload: ' + err.message;
        status.style.color = 'var(--red)';
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================================
//  5. NOTIFIKASI BELL
// ============================================================
function updateBellUI() {
  const btn = document.getElementById('bellBtn');
  if (!btn) return;
  if (Notification.permission === 'granted') {
    btn.innerHTML = '🔔'; btn.className = 'bell-btn bell-on'; btn.title = 'Pengingat aktif';
  } else {
    btn.innerHTML = '🔕'; btn.className = 'bell-btn bell-off'; btn.title = 'Aktifkan pengingat 5 menit';
  }
}
function requestNotif() {
  if (!('Notification' in window)) return showToast('⚠️ Browser tidak mendukung notifikasi.', true);
  if (Notification.permission === 'granted') { showToast('🔔 Pengingat sudah aktif!'); return; }
  Notification.requestPermission().then(perm => {
    updateBellUI();
    if (perm === 'granted') {
      showToast('✅ Pengingat diaktifkan! Bunyi 5 menit sebelum jadwal.');
      new Notification('🔔 Strong Daily Flow', { body: 'Pengingat jadwal harian aktif!' });
    } else {
      showToast('⚠️ Izin notifikasi ditolak.', true);
    }
  });
}
updateBellUI();

setInterval(() => {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  mySchedule.forEach(item => {
    if (item.completed) return;
    const [h, m] = item.time.split(':').map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    const diffMin = Math.floor((target - now) / 60000);
    if (diffMin === 5) {
      const lockKey = `alerted_${dateKey}_${item.id}`;
      if (!localStorage.getItem(lockKey)) {
        new Notification(`⏱️ 5 Menit Lagi: ${item.title}!`, {
          body: item.desc || 'Persiapkan diri kamu sekarang.'
        });
        localStorage.setItem(lockKey, 'true');
      }
    }
  });
}, 30000);
