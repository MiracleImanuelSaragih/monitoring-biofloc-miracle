// ============================================================
//  STRONG DAILY FLOW — script.js
//  Firebase Firestore + Real-time sync (HP ↔ Laptop)
// ============================================================

// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAcnTpDBXO2WpXs3ri21SXJfzUMC_xkCkU",
  authDomain: "premium-todo-list.firebaseapp.com",
  projectId: "premium-todo-list",
  storageBucket: "premium-todo-list.appspot.com",
  messagingSenderId: "630693485104",
  appId: "1:630693485104:web:820a99e6af935a7345abf5"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ── Tanggal hari ini ─────────────────────────────────────────
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const dateKey = getTodayDateString();

// ── Toast Notifikasi ─────────────────────────────────────────
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  setTimeout(() => { t.className = ''; }, 2800);
}

// ============================================================
//  1. NAVIGASI
// ============================================================
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${tabId}`).classList.add('active');
  btnElement.classList.add('active');
}

// ============================================================
//  2. PAGE 3 — ACCORDION PROGRAM LATIHAN
// ============================================================
function toggleDay(dayId) {
  const content = document.getElementById(`day-${dayId}`);
  const btn     = document.getElementById(`btn-${dayId}`);
  const isOpen  = content.classList.contains('open');

  // Tutup semua
  document.querySelectorAll('.day-content').forEach(c => c.classList.remove('open'));
  document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('open'));

  // Buka yang diklik (kalau sebelumnya tertutup)
  if (!isOpen) {
    content.classList.add('open');
    btn.classList.add('open');
  }
}

// ============================================================
//  3. PAGE 1 — JADWAL HARIAN
// ============================================================
let mySchedule = [];
let scheduleLoaded = false;

// ── Render daftar ────────────────────────────────────────────
function renderSchedule() {
  const container = document.getElementById('scheduleList');

  if (mySchedule.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Belum ada jadwal hari ini.</p>
        <p style="margin-top:4px;">Tambah rutinitas di form di atas.</p>
      </div>`;
    updateProgressBar(0, 0);
    return;
  }

  // Urutkan berdasarkan waktu
  mySchedule.sort((a, b) => a.time.localeCompare(b.time));

  container.innerHTML = '';

  mySchedule.forEach(item => {
    const done = item.completed || false;
    const div = document.createElement('div');
    div.className = `task-card${done ? ' completed' : ''}`;
    div.innerHTML = `
      <input type="checkbox" ${done ? 'checked' : ''}
        onchange="toggleCheck('${item.id}', ${done})">
      <div class="task-info" onclick="toggleCheck('${item.id}', ${done})">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.desc || 'Tidak ada catatan tambahan')}</p>
      </div>
      <span class="task-time-badge">${escapeHtml(item.time)}</span>
      <button class="delete-btn" onclick="deleteSchedule('${item.id}')" title="Hapus">🗑</button>
    `;
    container.appendChild(div);
  });

  const doneCount = mySchedule.filter(i => i.completed).length;
  updateProgressBar(doneCount, mySchedule.length);
}

function updateProgressBar(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    total === 0 ? 'Belum ada jadwal' : `${done} / ${total} selesai`;
  document.getElementById('progressPct').textContent = pct + '%';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Tambah jadwal baru ────────────────────────────────────────
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
    date: dateKey,
    time: time,
    title: title,
    desc: desc,
    completed: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    // Reset form
    document.getElementById('newTime').value  = '';
    document.getElementById('newTitle').value = '';
    document.getElementById('newDesc').value  = '';
    showToast('✅ Jadwal berhasil ditambahkan!');
  }).catch(err => {
    console.error('Gagal menyimpan:', err);
    showToast('❌ Gagal menyimpan ke cloud: ' + err.message, true);
  }).finally(() => {
    btn.disabled = false;
    btn.textContent = '+ MASUKKAN KE DAFTAR';
  });
}

// ── Toggle centang ────────────────────────────────────────────
function toggleCheck(docId, currentStatus) {
  db.collection('daily_routines').doc(docId)
    .update({ completed: !currentStatus })
    .catch(err => showToast('❌ Gagal update: ' + err.message, true));
}

// ── Hapus jadwal ──────────────────────────────────────────────
function deleteSchedule(docId) {
  if (!confirm('Hapus jadwal ini?')) return;
  db.collection('daily_routines').doc(docId)
    .delete()
    .then(() => showToast('🗑 Jadwal dihapus.'))
    .catch(err => showToast('❌ Gagal hapus: ' + err.message, true));
}

// ── Default template (hanya jika kosong) ─────────────────────
function injectDefaultTemplate() {
  const defaults = [
    { time:'07:00', title:'🍳 Sarapan Ringan',           desc:'1 Centong Nasi + 2 Butir Telur' },
    { time:'10:00', title:'🥛 Snack Pagi',               desc:'1 Gelas Susu Milo + Roti Tawar' },
    { time:'13:00', title:'🍛 Makan Siang',              desc:'1.5 Centong Nasi + Dada Ayam + Sayur' },
    { time:'16:00', title:'⚡ Pre-Workout Snack',        desc:'1 Gelas Susu Pemicu Energi' },
    { time:'16:30', title:'🏋️ Sesi Workout Latihan Otot',desc:'Lihat panduan gerakan di menu Program' },
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
    .catch(err => console.error('Gagal inject template:', err));
}

// ── Listener real-time ────────────────────────────────────────
db.collection('daily_routines')
  .where('date', '==', dateKey)
  .orderBy('time')
  .onSnapshot(snapshot => {
    mySchedule = [];
    snapshot.forEach(doc => {
      mySchedule.push({ id: doc.id, ...doc.data() });
    });

    if (!scheduleLoaded) {
      scheduleLoaded = true;
      if (mySchedule.length === 0) {
        injectDefaultTemplate();
        return; // akan di-render lagi saat snapshot berikutnya masuk
      }
    }

    renderSchedule();
  }, err => {
    console.error('Firestore listener error:', err);
    document.getElementById('scheduleList').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Gagal memuat data: ${err.message}</p>
        <p style="margin-top:4px;">Cek koneksi & Firebase Rules kamu.</p>
      </div>`;
    document.getElementById('progressLabel').textContent = 'Gagal memuat';
  });

// ============================================================
//  4. PAGE 2 — PROGRESS TRACKER (Berat Badan & Foto)
// ============================================================

// ── Berat Badan ──────────────────────────────────────────────
db.collection('fitness_metrics').doc('weight_latest')
  .onSnapshot(doc => {
    document.getElementById('weightLoading').style.display = 'none';

    if (doc.exists && doc.data().current) {
      const data = doc.data();
      document.getElementById('weightInput').value = data.current || '';
      document.getElementById('goalInput').value   = data.target  || '';

      const wd = document.getElementById('weightDisplay');
      wd.style.display = 'block';
      document.getElementById('wdCurrent').textContent = `${data.current} kg`;
      document.getElementById('wdTarget').textContent  = `Target: ${data.target || '—'} kg`;
    } else {
      document.getElementById('weightDisplay').style.display = 'none';
    }
  }, err => {
    document.getElementById('weightLoading').innerHTML =
      `<p style="color:#ef4444;font-size:12px;">Gagal memuat: ${err.message}</p>`;
  });

function saveWeightCloud() {
  const cw = document.getElementById('weightInput').value;
  const tw = document.getElementById('goalInput').value;

  if (!cw || !tw) return showToast('⚠️ Isi berat sekarang & target!', true);

  db.collection('fitness_metrics').doc('weight_latest').set({
    current: cw,
    target:  tw,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    showToast('✅ Berat badan tersinkronisasi ke semua perangkat!');
  }).catch(err => {
    showToast('❌ Gagal sync: ' + err.message, true);
  });
}

// ── Foto Progres ─────────────────────────────────────────────

// Muat foto dari cloud saat pertama kali
db.collection('fitness_metrics').doc('photo_latest')
  .onSnapshot(doc => {
    if (doc.exists && doc.data().base64Data) {
      showPhotoPreview(doc.data().base64Data);
    }
  }, err => {
    console.error('Gagal muat foto:', err);
  });

function showPhotoPreview(base64) {
  const img = document.getElementById('photoDisplay');
  const placeholder = document.getElementById('photoPlaceholder');
  img.src = base64;
  img.style.display = 'block';
  placeholder.style.display = 'none';
  // Hapus border dashed setelah ada foto
  document.getElementById('photoContainer').style.border = 'none';
}

function uploadPhotoCloud(event) {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('photoUploadStatus');
  status.textContent = '⏳ Mengompres & mengunggah foto...';
  status.style.color = 'var(--text-dim)';

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Kompres gambar menggunakan canvas
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 500;
      const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.7);

      // Tampilkan preview lokal langsung
      showPhotoPreview(compressed);

      // Upload ke Firestore
      db.collection('fitness_metrics').doc('photo_latest').set({
        base64Data: compressed,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        status.textContent = '✅ Foto berhasil disinkronkan ke semua perangkat!';
        status.style.color = 'var(--green)';
        showToast('📸 Foto progres diperbarui!');
        setTimeout(() => { status.textContent = ''; }, 3000);
      }).catch(err => {
        status.textContent = '❌ Gagal upload: ' + err.message;
        status.style.color = 'var(--red)';
        showToast('❌ Gagal upload foto', true);
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================================
//  5. NOTIFIKASI BELL (dengan visual aktif/nonaktif jelas)
// ============================================================
function updateBellUI() {
  const btn = document.getElementById('bellBtn');
  if (Notification.permission === 'granted') {
    btn.innerHTML  = '🔔';
    btn.className  = 'bell-btn bell-on';
    btn.title      = 'Pengingat aktif — ketuk untuk info';
  } else {
    btn.innerHTML  = '🔕';
    btn.className  = 'bell-btn bell-off';
    btn.title      = 'Ketuk untuk aktifkan pengingat 5 menit';
  }
}

function requestNotif() {
  if (!('Notification' in window)) {
    return showToast('⚠️ Browser ini tidak mendukung notifikasi.', true);
  }

  if (Notification.permission === 'granted') {
    showToast('🔔 Pengingat sudah aktif!');
    return;
  }

  Notification.requestPermission().then(perm => {
    updateBellUI();
    if (perm === 'granted') {
      showToast('✅ Pengingat diaktifkan! Bunyi 5 menit sebelum jadwal.');
      // Kirim notif test
      new Notification('🔔 Strong Daily Flow', {
        body: 'Pengingat jadwal harian berhasil diaktifkan!',
      });
    } else {
      showToast('⚠️ Izin notifikasi ditolak.', true);
    }
  });
}

// Inisialisasi status bell saat halaman dimuat
updateBellUI();

// ── Alarm Engine: cek setiap 30 detik ────────────────────────
setInterval(() => {
  if (Notification.permission !== 'granted') return;

  const now = new Date();

  mySchedule.forEach(item => {
    if (item.completed) return;

    const [h, m] = item.time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);

    const diffMin = Math.floor((target - now) / 60000);

    if (diffMin === 5) {
      const lockKey = `alerted_${dateKey}_${item.id}`;
      if (!localStorage.getItem(lockKey)) {
        new Notification(`⏱️ 5 Menit Lagi: ${item.title}!`, {
          body: item.desc || 'Persiapkan diri kamu sekarang.',
        });
        localStorage.setItem(lockKey, 'true');
      }
    }
  });
}, 30000);
