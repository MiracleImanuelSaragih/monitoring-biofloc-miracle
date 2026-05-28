// Konfigurasi Firebase Anda
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

// Helpers Tanggal
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}
const dateKey = getTodayDateString();

// =====================================
// 1. NAVIGATION LOGIC (Ganti Mode)
// =====================================
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  
  document.getElementById(`page-${tabId}`).classList.add('active');
  btnElement.classList.add('active');
}

// =====================================
// 2. SCHEDULE & CHECKLIST LOGIC
// =====================================
let mySchedule = [];

// Fungsi render ke layar
function renderSchedule() {
  const container = document.getElementById("scheduleList");
  container.innerHTML = "";
  
  // Urutkan berdasarkan jam
  mySchedule.sort((a, b) => a.time.localeCompare(b.time));

  mySchedule.forEach(item => {
    const isDone = item.completed || false;
    const div = document.createElement("div");
    div.className = `task-card ${isDone ? 'completed' : ''}`;
    
    div.innerHTML = `
      <input type="checkbox" ${isDone ? "checked" : ""} onchange="toggleCheck('${item.id}', ${isDone})">
      <div class="task-info" onclick="toggleCheck('${item.id}', ${isDone})">
        <h4>${item.time} - ${item.title}</h4>
        <p>${item.desc}</p>
      </div>
      <button onclick="deleteSchedule('${item.id}')" style="background:none; border:none; color:#ff4444; font-size:18px;">🗑️</button>
    `;
    container.appendChild(div);
  });
}

// Tambah jadwal custom baru
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
    completed: false,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("newTime").value = "";
  document.getElementById("newTitle").value = "";
  document.getElementById("newDesc").value = "";
}

// Toggle Check
function toggleCheck(docId, currentStatus) {
  db.collection("daily_routines").doc(docId).update({ completed: !currentStatus });
}

// Hapus Jadwal
function deleteSchedule(docId) {
  if(confirm("Hapus jadwal ini?")) {
    db.collection("daily_routines").doc(docId).delete();
  }
}

// Tarik data realtime dari Firebase
db.collection("daily_routines")
  .where("date", "==", dateKey)
  .onSnapshot(snapshot => {
    mySchedule = [];
    snapshot.forEach(doc => {
      mySchedule.push({ id: doc.id, ...doc.data() });
    });
    
    // Jika data kosong, masukkan template default
    if(mySchedule.length === 0) {
      injectDefaultTemplate();
    } else {
      renderSchedule();
    }
});

function injectDefaultTemplate() {
  const defaultTemplates = [
    { time: "07:00", title: "🍳 Sarapan Pagi", desc: "1 Centong Nasi + 2 Telur" },
    { time: "10:00", title: "🥛 Snack Pagi", desc: "Susu Milo + Pisang" },
    { time: "16:30", title: "💪 Sesi Latihan", desc: "Sesuai program hari ini" }
  ];
  
  defaultTemplates.forEach(t => {
    db.collection("daily_routines").add({
      date: dateKey, time: t.time, title: t.title, desc: t.desc, completed: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

// =====================================
// 3. PROGRESS LOGIC (Berat & Foto)
// =====================================
function saveWeight() {
  const w = document.getElementById("weightInput").value;
  const g = document.getElementById("goalInput").value;
  if(w) {
    localStorage.setItem("myWeight", w);
    localStorage.setItem("myGoal", g);
    updateWeightDisplay();
    alert("Progress berat badan disimpan!");
  }
}

function updateWeightDisplay() {
  const w = localStorage.getItem("myWeight");
  const g = localStorage.getItem("myGoal");
  if(w) {
    document.getElementById("weightInput").value = w;
    let text = `Berat saat ini: ${w} kg`;
    if(g) {
      document.getElementById("goalInput").value = g;
      text += ` | Target: ${g} kg (Sisa ${Math.abs(g - w)} kg lagi!)`;
    }
    document.getElementById("weightDisplay").innerText = text;
  }
}
updateWeightDisplay(); // Panggil saat load

// Foto Lokal (Menghindari limitasi quota firebase)
function previewAndSaveImage(event) {
  const file = event.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Image = e.target.result;
      const imgElem = document.getElementById("photoDisplay");
      imgElem.src = base64Image;
      imgElem.style.display = "block";
      
      // Simpan di memori HP
      try {
        localStorage.setItem("myProgressPhoto", base64Image);
      } catch (e) {
        alert("Gambar terlalu besar untuk disimpan di memori internal HP.");
      }
    };
    reader.readAsDataURL(file);
  }
}

// Load foto lama jika ada
window.onload = function() {
  const savedPhoto = localStorage.getItem("myProgressPhoto");
  if(savedPhoto) {
    const imgElem = document.getElementById("photoDisplay");
    imgElem.src = savedPhoto;
    imgElem.style.display = "block";
  }
};

// =====================================
// 4. NOTIFICATION ENGINE (5 Menit Sebelum)
// =====================================
function requestNotif() {
  if (!("Notification" in window)) {
    alert("HP kamu tidak support notifikasi browser.");
  } else if (Notification.permission === "granted") {
    alert("Notifikasi sudah aktif! (Akan bunyi 5 menit sebelum jadwal)");
    document.getElementById("bellIcon").style.color = "#00ff00";
  } else {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        document.getElementById("bellIcon").style.color = "#00ff00";
        alert("Sip, pengingat 5 menit aktif!");
      }
    });
  }
}

// Cek permission warna icon saat load
if(Notification.permission === "granted") {
  document.getElementById("bellIcon").style.color = "#00ff00";
}

// Interval cek jam
setInterval(() => {
  if (Notification.permission !== "granted") return;
  
  const now = new Date();
  
  mySchedule.forEach(item => {
    if(item.completed) return; // Skip jika sudah dicentang
    
    // Pecah jam jadwal (misal "16:30")
    const [jam, menit] = item.time.split(':').map(Number);
    const targetTime = new Date();
    targetTime.setHours(jam, menit, 0, 0);
    
    // Hitung selisih waktu dalam menit
    const diffMs = targetTime - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    // Jika tepat 5 menit sebelum jadwal
    if (diffMins === 5) {
      // Pastikan belum pernah dinotif untuk mencegah spam
      const notifKey = `notif_${dateKey}_${item.id}`;
      if(!localStorage.getItem(notifKey)) {
        new Notification(`🔥 5 Menit lagi: ${item.title}!`, {
          body: item.desc,
          icon: "https://cdn-icons-png.flaticon.com/512/3043/3043211.png"
        });
        localStorage.setItem(notifKey, "true");
      }
    }
  });
}, 30000); // Cek setiap 30 detik
