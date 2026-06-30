// ════════════════════════════════════════════════════════════
//  AQUA SENTINEL — config.js
//  SEMUA bagian yang perlu kamu SESUAIKAN ada di file ini.
//  File lain (app.js, dashboard.js, dst) TIDAK perlu diubah.
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 1. FIREBASE PROJECT CONFIG
// ─────────────────────────────────────────────────────────────
// Kalau kamu pakai Firebase project KAMU SENDIRI: isi config di bawah
// dengan punya kamu (Firebase Console > Project Settings > General).
//
// Kalau kamu mau PAKAI Firebase TEMAN (sensor mereka sudah kirim data
// ke sana): minta teman kamu kirim "Firebase config object" mereka
// (sama persis bentuknya seperti di bawah ini), lalu GANTI seluruh
// object FIREBASE_CONFIG ini dengan punya mereka.
//
// ⚠️ Kalau pakai Firebase teman, kamu HARUS minta mereka menambahkan
// kamu sebagai member di Firebase Console (Project Settings > Users
// and permissions > Add member) supaya Authentication & Database
// rules mengizinkan akun kamu mengakses data.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAcnTpDBXO2WpXs3ri21SXJfzUMC_xkCkU",
  authDomain: "premium-todo-list.firebaseapp.com",
  projectId: "premium-todo-list",
  storageBucket: "premium-todo-list.appspot.com",
  messagingSenderId: "630693485104",
  appId: "1:630693485104:web:820a99e6af935a7345abf5",
  // ⬇️ WAJIB diisi kalau pakai Realtime Database (bukan Firestore).
  // Bentuknya: "https://NAMA-PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app"
  // Lihat di Firebase Console > Realtime Database > paling atas halaman.
  databaseURL: "https://premium-todo-list-default-rtdb.firebaseio.com"
};

// ─────────────────────────────────────────────────────────────
// 2. PATH / STRUKTUR DATA DI FIREBASE REALTIME DATABASE
// ─────────────────────────────────────────────────────────────
// Ini adalah "alamat" tempat data sensor disimpan di database.
// SESUAIKAN nilai di sini dengan struktur yang dipakai sensor/ESP32
// kamu atau teman kamu. Cara cek: buka Firebase Console > Realtime
// Database > lihat pohon data (tree) di sana, lalu samakan key-nya.
//
// CONTOH struktur yang umum dipakai (default di bawah ini):
//   sensor/
//     ph: 7.2
//     suhu: 28.5
//     do: 5.1
//     tds: 1200
//     timestamp: 1719999999
//
// Kalau struktur teman kamu BEDA, misal datanya ada di "kolam1/data/ph"
// atau "device001/readings/ph_value", ganti string di bawah ini saja.

const PATHS = {
  // Lokasi pembacaan sensor TERKINI (real-time, selalu di-overwrite)
  liveSensor: "sensor",            // contoh lain: "kolam1/data"

  // Lokasi RIWAYAT/HISTORY pembacaan sensor (banyak entri, untuk grafik & tabel)
  // Setiap entri baru harus berbentuk: { ph, suhu, do, tds, timestamp }
  sensorHistory: "sensor_history", // contoh lain: "kolam1/history"

  // Lokasi hasil PREDIKSI dari model Random Forest (Python).
  // Kalau belum ada Python yang nulis ke sini, web otomatis pakai
  // perhitungan tren sederhana sebagai cadangan (lihat prediction.js).
  // Format yang diharapkan Python menulis ke sini:
  //   { predicted_ph: 6.3, hours_ahead: 6, generated_at: 1719999999,
  //     model: "RandomForestRegressor", confidence: 0.82 }
  phPrediction: "predictions/ph_forecast",

  // Lokasi pengaturan ambang batas (threshold) — bisa diubah dari
  // halaman Settings web ini, atau manual lewat Firebase Console.
  thresholds: "settings/thresholds",

  // Lokasi log peringatan (EWS) yang tercatat sistem
  alertLog: "alerts/log"
};

// ─────────────────────────────────────────────────────────────
// 3. NAMA FIELD SENSOR (kalau key di Firebase kamu berbeda nama)
// ─────────────────────────────────────────────────────────────
// Misal kamu kirim "ph_value" bukan "ph" — tinggal ganti di sini.

const FIELD_MAP = {
  ph: "ph",
  suhu: "suhu",        // contoh lain: "temperature", "temp"
  do: "do",            // contoh lain: "dissolved_oxygen"
  tds: "tds",
  timestamp: "timestamp"
};

// ─────────────────────────────────────────────────────────────
// 4. THRESHOLD DEFAULT — Standar Budidaya Nila Sistem Biofloc
// ─────────────────────────────────────────────────────────────
// Dipakai pertama kali sebelum user mengatur sendiri di halaman Settings.
// Rentang berdasarkan literatur budidaya nila (Oreochromis niloticus)
// pada sistem bioflok. Sesuaikan di halaman Settings web kalau pembimbing
// kamu punya acuan/SOP berbeda.

const DEFAULT_THRESHOLDS = {
  ph:   { min: 6.5, max: 8.5, danger_min: 6.0, danger_max: 9.0, unit: "" },
  suhu: { min: 25,  max: 30,  danger_min: 20,  danger_max: 34,  unit: "°C" },
  do:   { min: 4,   max: 12,  danger_min: 3,   danger_max: 15,  unit: "mg/L" },
  tds:  { min: 0,   max: 2500,danger_min: 0,   danger_max: 3500,unit: "ppm" }
};

// ─────────────────────────────────────────────────────────────
// 5. EARLY WARNING SYSTEM — Konfigurasi Prediksi
// ─────────────────────────────────────────────────────────────
const EWS_CONFIG = {
  // Berapa jam ke depan sistem mencoba memprediksi tren pH
  forecastHorizonHours: 6,
  // Minimal jumlah data history pH yang dibutuhkan sebelum prediksi
  // tren sederhana (fallback) bisa dihitung
  minDataPointsForTrend: 8,
  // Kalau data sensor TIDAK update lebih dari X menit, anggap sensor offline
  sensorOfflineMinutes: 10
};

// Jangan ubah baris-baris di bawah ini ↓
window.AQUA_CONFIG = { FIREBASE_CONFIG, PATHS, FIELD_MAP, DEFAULT_THRESHOLDS, EWS_CONFIG };
