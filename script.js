// Firebase versi 8.x (non-modular)
const firebaseConfig = {
  apiKey: "AIzaSyAcnTpDBXO2WpXs3ri21SXJfzUMC_xkCkU",
  authDomain: "premium-todo-list.firebaseapp.com",
  projectId: "premium-todo-list",
  storageBucket: "premium-todo-list.appspot.com",
  messagingSenderId: "630693485104",
  appId: "1:630693485104:web:820a99e6af935a7345abf5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// 🔹 DATA STRUKTUR PROGRAM BULKING & GERD PROTECT
// ==========================================
const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const hariIniIndex = new Date().getDay();
document.getElementById("currentDayName").innerText = namaHari[hariIniIndex];

// Jadwal Olahraga Dinamis sesuai hari aktif
const menuWorkout = {
  1: "🏋️ Upper Body 1 (Pull-up 3x8, Push-up 3x15, DB Row 3x12, DB Shoulder Press 3x12)",
  2: "🦵 Lower Body & Core (Bodyweight Squat 3x20, Bulgarian Split Squat 3x10, Sit-up 3x20, Plank 45 detik)",
  3: "😴 Rest Day (Fokus istirahat penuh dan pemulihan asam lambung)",
  4: "🏋️ Upper Body 2 (Chin-up 3x8, Incline Push-up 3x12, DB Curl 3x15, Chair Dips 3x15)",
  5: "🦵 Lower Body & Core (Goblet Squat 3x15, Walking Lunges 3x12, Leg Raises 3x15)",
  6: "😴 Rest Day (Pemulihan total otot & santai di rumah)",
  0: "⚖️ Rest Day (Evaluasi timbangan badan di pagi hari setelah bangun tidur)"
};

const templateBulking = [
  { id: "makan1", time: "07:00", title: "🍳 Sarapan Ringan", desc: "1 Centong Nasi + 2 Butir Telur (Dadar/Ceplok/Rebus)" },
  { id: "makan2", time: "10:00", title: "🥛 Snack Pagi", desc: "1 Gelas Susu Milo + 1 Buah Pisang / Roti Tawar" },
  { id: "makan3", time: "13:00", title: "🍛 Makan Siang", desc: "1.5 Centong Nasi + 2 Potong Tempe/Tahu + Sayur Masakan Rumah" },
  { id: "makan4", time: "16:00", title: "⚡ Pre-Workout Snack", desc: "1 Gelas Susu Milo (Sediaan energi latihan)" },
  { id: "workout", time: "16:30", title: "💪 Sesi Latihan Otot", desc: menuWorkout[hariIniIndex] },
  { id: "makan5", time: "19:00", title: "🍗 Makan Malam", desc: "1.5 Centong Nasi + Protein Rumah + Sayur (Makan 2 jam sebelum tidur!)" }
];

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

const dateKey = getTodayDateString();

// 🔥 FUNGSI REVOLUSIONER: Menggambar list ke layar secara instan tanpa nunggu database
function renderBulkingList(completedIds = {}) {
  const container = document.getElementById("bulkingList");
  if (!container) return;
  container.innerHTML = "";

  templateBulking.forEach(item => {
    const isCompleted = completedIds[item.id] || false;
    const div = document.createElement("div");
    div.className = "task" + (isCompleted ? " completed" : "");
    div.innerHTML = `
      <div class="task-content">
        <input type="checkbox" ${isCompleted ? "checked" : ""} onchange="toggleBulkingCheck('${item.id}', ${isCompleted})">
        <div class="task-text">
          <b>${item.time} - ${item.title}</b>
          <small>${item.desc}</small>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// Ambil backup data lokal HP terlebih dahulu agar layar tidak kosong saat loading
let localBackup = JSON.parse(localStorage.getItem("fallback_bulking_" + dateKey) || "{}");
renderBulkingList(localBackup);

// Hubungkan ke Firebase (Dilengkapi pengaman jika database terkunci)
db.collection("bulking_tracker").where("date", "==", dateKey).onSnapshot(snapshot => {
  let completedIds = {};
  snapshot.forEach(doc => {
    completedIds[doc.data().taskId] = doc.data().completed;
  });
  localStorage.setItem("fallback_bulking_" + dateKey, JSON.stringify(completedIds));
  localBackup = completedIds;
  renderBulkingList(completedIds);
}, error => {
  console.log("Firebase Terkunci/Error. Menggunakan sistem penyimpanan lokal HP.", error);
  renderBulkingList(localBackup);
});

function toggleBulkingCheck(taskId, currentStatus) {
  // Update lokal HP secara instan agar responsif saat diklik
  localBackup[taskId] = !currentStatus;
  localStorage.setItem("fallback_bulking_" + dateKey, JSON.stringify(localBackup));
  renderBulkingList(localBackup);

  // Kirim data cadangan ke cloud Firebase jika akses terbuka
  const docId = `${dateKey}_${taskId}`;
  db.collection("bulking_tracker").doc(docId).set({
    date: dateKey,
    taskId: taskId,
    completed: !currentStatus
  }, { merge: true }).catch(err => {
    console.log("Gagal sinkronisasi awan, data aman disimpan di internal HP.");
  });
}

// ==========================================
// 🔹 SISTEM PUSH NOTIFICATION ENGINE
// ==========================================
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Browser HP/Laptop kamu tidak mengizinkan atau tidak mendukung Web Notification standard.");
  } else if (Notification.permission === "granted") {
    alert("Sistem pengingat harian sudah aktif!");
  } else {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        alert("Akses diizinkan! Pengingat otomatis diaktifkan.");
      } else {
        alert("Izin ditolak. Kamu harus membuka pengaturan browser di HP secara manual untuk mengaktifkan notifikasinya.");
      }
    });
  }
}

// Pengecek Jam Masakan/Latihan (Setiap 30 Detik)
setInterval(() => {
  const sekarang = new Date();
  const waktuSekarang = `${sekarang.getHours().toString().padStart(2,'0')}:${sekarang.getMinutes().toString().padStart(2,'0')}`;

  if (window.Notification && Notification.permission === "granted") {
    templateBulking.forEach(item => {
      if (item.time === waktuSekarang) {
        if (!localBackup[item.id]) {
          new Notification(`Waktunya ${item.title}!`, {
            body: item.desc,
            icon: "https://cdn-icons-png.flaticon.com/512/3043/3043211.png"
          });
        }
      }
    });
  }
}, 30000);

// ==========================================
// 🔹 LOGIKA CORE INTERFACE LAMA (TASKS & SCHEDULE)
// ==========================================
function addTask() {
  const text = document.getElementById("taskText").value.trim();
  const time = document.getElementById("taskTime").value;
  const reminder = +document.getElementById("taskReminder").value;
  if (!text || !time) return alert("Lengkapi data tugas");

  db.collection("tasks").add({
    text,
    time,
    reminder,
    completed: false,
    reminded: false,
    alarmed: false,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("taskText").value = "";
  document.getElementById("taskTime").value = "";
}

function toggleTask(id, current) {
  db.collection("tasks").doc(id).update({ completed: !current });
}

function delTask(id) {
  if (confirm("Hapus tugas?")) {
    db.collection("tasks").doc(id).delete();
  }
}

db.collection("tasks").orderBy("timestamp", "desc").onSnapshot(snapshot => {
  const list = document.getElementById("taskList");
  list.innerHTML = "";
  snapshot.forEach(doc => {
    const t = doc.data();
    const dt = new Date(t.time);
    const div = document.createElement("div");
    div.className = "task" + (t.completed ? " completed" : "");
    div.innerHTML = `
      <div class="task-content">
        <input type="checkbox" ${t.completed ? "checked" : ""} onchange="toggleTask('${doc.id}', ${t.completed})">
        <div class="task-text">
          <b>${t.text}</b>
          <small>⏰ ${dt.toLocaleString()}</small>
        </div>
      </div>
      <button onclick="delTask('${doc.id}')">🗑️</button>
    `;
    list.appendChild(div);
  });
});

function addSchedule() {
  const text = document.getElementById("scheduleText").value.trim();
  const time = document.getElementById("scheduleTime").value;
  if (!text || !time) return alert("Lengkapi data jadwal");

  db.collection("schedule").add({
    text,
    time,
    completed: false,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("scheduleText").value = "";
  document.getElementById("scheduleTime").value = "";
}

function toggleSchedule(id, current) {
  db.collection("schedule").doc(id).update({ completed: !current });
}

function delSchedule(id) {
  if (confirm("Hapus jadwal?")) {
    db.collection("schedule").doc(id).delete();
  }
}

db.collection("schedule").orderBy("timestamp", "desc").onSnapshot(snapshot => {
  const list = document.getElementById("scheduleList");
  list.innerHTML = "";
  snapshot.forEach(doc => {
    const s = doc.data();
    const dt = new Date(s.time);
    const div = document.createElement("div");
    div.className = "task" + (s.completed ? " completed" : "");
    div.innerHTML = `
      <div class="task-content">
        <input type="checkbox" ${s.completed ? "checked" : ""} onchange="toggleSchedule('${doc.id}', ${s.completed})">
        <div class="task-text">
          <b>${s.text}</b>
          <small>⏰ ${dt.toLocaleString()}</small>
        </div>
      </div>
      <button onclick="delSchedule('${doc.id}')">🗑️</button>
    `;
    list.appendChild(div);
  });
});
