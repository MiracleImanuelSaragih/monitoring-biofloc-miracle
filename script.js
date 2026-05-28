// Konfigurasi Firebase Firestore
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

// Formatter Tanggal Lokal PC/HP Anda
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}
const dateKey = getTodayDateString();

// =====================================
// 1. NAVIGATION LOGIC (Sistem Navigasi Aplikasi)
// =====================================
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  
  document.getElementById(`page-${tabId}`).classList.add('active');
  btnElement.classList.add('active');
}

function toggleDay(dayId) {
  const element = document.getElementById(dayId);
  const isVisible = element.style.display === "block";
  document.querySelectorAll('.day-content').forEach(c => c.style.display = "none");
  element.style.display = isVisible ? "none" : "block";
}

// =====================================
// 2. PAGE 1: REAL-TIME SCHEDULE & CHECKLIST LOGIC
// =====================================
let mySchedule = [];

function renderSchedule() {
  const container = document.getElementById("scheduleList");
  container.innerHTML = "";
  
  // Mengurutkan jadwal secara alfabetis berdasarkan string jam ("07:00", "10:00", dll)
  mySchedule.sort((a, b) => a.time.localeCompare(b.time));

  mySchedule.forEach(item => {
    const isDone = item.completed || false;
    const div = document.createElement("div");
    div.className = `task-card ${isDone ? 'completed' : ''}`;
    
    div.innerHTML = `
      <input type="checkbox" ${isDone ? "checked" : ""} onchange="toggleCheck('${item.id}', ${isDone})">
      <div class="task-info" onclick="toggleCheck('${item.id}', ${isDone})">
        <h4>${item.time} - ${item.title}</h4>
        <p>${item.desc || 'Tidak ada catatan tambahan'}</p>
      </div>
      <button onclick="deleteSchedule('${item.id}')" style="background:none; border:none; color:#ff4444; font-size:18px; cursor:pointer;">🗑️</button>
    `;
    container.appendChild(div);
  });
}

function addNewSchedule() {
  const time = document.getElementById("newTime").value;
  const title = document.getElementById("newTitle").value.trim();
  const desc = document.getElementById("newDesc").value.trim();
  
  if(!time || !title) return alert("Jam dan Nama Jadwal wajib diisi!");

  db.collection("daily_routines").add({
    date: dateKey,
    time: time,
    title: title,
    desc: desc,
    completed: false
  }).then(() => {
    document.getElementById("newTime").value = "";
    document.getElementById("newTitle").value = "";
    document.getElementById("newDesc").value = "";
  }).catch(err => alert("Gagal menyimpan ke cloud: " + err));
}

function toggleCheck(docId, currentStatus) {
  db.collection("daily_routines").doc(docId).update({ completed: !currentStatus });
}

function deleteSchedule(docId) {
  if(confirm("Hapus jadwal ini dari daftar harian?")) {
    db.collection("daily_routines").doc(docId).delete();
  }
}

// Sinkronisasi data daftar harian dari database
db.collection("daily_routines")
  .where("date", "==", dateKey)
  .onSnapshot(snapshot => {
    mySchedule = [];
    snapshot.forEach(doc => {
      mySchedule.push({ id: doc.id, ...doc.data() });
    });
    
    if(mySchedule.length === 0) {
      injectDefaultTemplate();
    } else {
      renderSchedule();
    }
});

function injectDefaultTemplate() {
  const defaultTemplates = [
    { time: "07:00", title: "🍳 Sarapan Ringan", desc: "1 Centong Nasi + 2 Butir Telur" },
    { time: "10:00", title: "🥛 Snack Pagi", desc: "1 Gelas Susu Milo + Roti Tawar" },
    { time: "13:00", title: "🍛 Makan Siang", desc: "1.5 Centong Nasi + Dada Ayam + Sayur Masak" },
    { time: "16:00", title: "⚡ Pre-Workout Snack", desc: "1 Gelas Susu Pemicu Energi" },
    { time: "16:30", title: "🏋️ Sesi Workout Latihan Otot", desc: "Lihat panduan gerakan di menu Program" },
    { time: "19:00", title: "🍗 Makan Malam Kalori Booster", desc: "1.5 Centong Nasi + Telur/Daging Rumah" }
  ];
  
  defaultTemplates.forEach(t => {
    db.collection("daily_routines").add({
      date: dateKey, time: t.time, title: t.title, desc: t.desc, completed: false
    });
  });
}

// =====================================
// 3. PAGE 2: CLOUD SINKRONISASI PROGRESS DATA (HP & LAPTOP)
// =====================================

// Ambil & Tampilkan data Berat Badan antar perangkat secara Real-Time
db.collection("fitness_metrics").doc("weight_latest").onSnapshot(doc => {
  if(doc.exists) {
    const data = doc.data();
    document.getElementById("weightInput").value = data.current || "";
    document.getElementById("goalInput").value = data.target || "";
    document.getElementById("weightDisplay").innerText = `⚖️ Berat: ${data.current} kg ➔ Target Goal: ${data.target} kg`;
  } else {
    document.getElementById("weightDisplay").innerText = "Belum ada riwayat berat badan.";
  }
});

function saveWeightCloud() {
  const currentWeight = document.getElementById("weightInput").value;
  const targetWeight = document.getElementById("goalInput").value;
  
  if(!currentWeight || !targetWeight) return alert("Isi nilai berat badan saat ini dan target!");

  db.collection("fitness_metrics").doc("weight_latest").set({
    current: currentWeight,
    target: targetWeight,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => alert("Data berat badan berhasil disinkronkan ke seluruh perangkat!"));
}

// Ambil & Tampilkan Foto Progres Utama antar perangkat secara Real-Time
db.collection("fitness_metrics").doc("photo_latest").onSnapshot(doc => {
  const statusLabel = document.getElementById("photoStatus");
  const imgDisplay = document.getElementById("photoDisplay");
  
  if(doc.exists && doc.data().base64Data) {
    statusLabel.style.display = "none";
    imgDisplay.src = doc.data().base64Data;
    imgDisplay.style.display = "block";
  } else {
    statusLabel.style.display = "block";
    imgDisplay.style.display = "none";
  }
});

function uploadPhotoCloud(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Kompresi Gambar Menggunakan Canvas (Supaya muat & sinkron cepat antar HP-Laptop)
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 450; 
      const scale = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
      
      document.getElementById("photoStatus").innerText = "Mengunggah foto...";
      
      db.collection("fitness_metrics").doc("photo_latest").set({
        base64Data: compressedBase64,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        alert("Foto kemajuan fisik berhasil diperbarui di HP & Laptop!");
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// =====================================
// 4. ALARM ENGINE (Peringatan 5 Menit Sebelum Jadwal)
// =====================================
function requestNotif() {
  if (!("Notification" in window)) {
    alert("Browser perangkat ini tidak mendukung notifikasi.");
  } else if (Notification.permission === "granted") {
    alert("Sistem pengingat terjadwal sudah aktif!");
    updateBellUI();
  } else {
    Notification.requestPermission().then(permission => {
      updateBellUI();
      if (permission === "granted") alert("Akses disetujui! Notifikasi otomatis berbunyi 5 menit sebelum target.");
    });
  }
}

function updateBellUI() {
  const bell = document.getElementById("bellIcon");
  if(Notification.permission === "granted") {
    bell.innerHTML = "🔔";
    bell.style.color = "#ff6b00";
    bell.style.filter = "drop-shadow(0 0 6px #ff6b00)";
  } else {
    bell.innerHTML = "🔕";
    bell.style.color = "#9ca3af";
    bell.style.filter = "none";
  }
}
updateBellUI(); // Inisialisasi status lonceng saat halaman dimuat

// Detektor Waktu Mundur Intermiten (Interval 30 Detik)
setInterval(() => {
  if (Notification.permission !== "granted") return;
  
  const sekarang = new Date();
  
  mySchedule.forEach(item => {
    if(item.completed) return; 
    
    const [targetJam, targetMenit] = item.time.split(':').map(Number);
    const waktuTarget = new Date();
    waktuTarget.setHours(targetJam, targetMenit, 0, 0);
    
    const selisihMilidetik = waktuTarget - sekarang;
    const sisaMenit = Math.floor(selisihMilidetik / 60000);
    
    // Picu alarm tepat 5 Menit sebelum jam makan/latihan dimulai
    if (sisaMenit === 5) {
      const lockKey = `alerted_${dateKey}_${item.id}`;
      if(!localStorage.getItem(lockKey)) {
        new Notification(`⏱️ 5 Menit Lagi: ${item.title}!`, {
          body: item.desc || "Persiapkan menu kalori / gear workout kamu sekarang.",
          icon: "https://cdn-icons-png.flaticon.com/512/3043/3043211.png"
        });
        localStorage.setItem(lockKey, "true");
      }
    }
  });
}, 30000);
