// Konfigurasi MQTT
const broker = "wss://801aa7276cf24c3881064f8513f377c6.s1.eu.hivemq.cloud:8884/mqtt";
const options = {
  username: "heart_rate",
  password: "@Barokibnul725",
  reconnectPeriod: 5000,
  connectTimeout: 30 * 1000,
  clean: true,
  clientId: "web_dashboard_" + Math.random().toString(16).substr(2, 8)
};

const TOPIC = "health/monitor/data";

// Elemen DOM
const hrElement = document.getElementById("hr");
const spo2Element = document.getElementById("spo2");
const ledIndicator = document.getElementById("ledIndicator");
const statusTextSpan = document.getElementById("statusText");

// Data untuk grafik HR
let hrLabels = [];
let hrValues = [];
// Data untuk grafik SpO2
let spo2Labels = [];
let spo2Values = [];

const MAX_POINTS = 30;

let hrChart = null;
let spo2Chart = null;

let latestHR = null;
let latestSpO2 = null;
let client = null;

// ================= INISIALISASI DUA GRAFIK =================
function initCharts() {
  const hrCtx = document.getElementById("hrChart").getContext("2d");
  const spo2Ctx = document.getElementById("spo2Chart").getContext("2d");
  
  if (hrChart) hrChart.destroy();
  if (spo2Chart) spo2Chart.destroy();
  
  // Grafik Heart Rate dengan sumbu Y tetap 50-200
  hrChart = new Chart(hrCtx, {
    type: "line",
    data: {
      labels: hrLabels,
      datasets: [{
        label: "Detak Jantung (bpm)",
        data: hrValues,
        borderColor: "#ff5e7e",
        backgroundColor: "rgba(255, 94, 126, 0.1)",
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: "#ff7b9c",
        tension: 0.2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: "#cbd5f0" } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        y: { 
          title: { display: true, text: "bpm", color: "#9aa9c9" }, 
          ticks: { color: "#bdc4e0", stepSize: 25 },
          min: 50,
          max: 200,
          grid: { color: "rgba(200,212,255,0.08)" } 
        },
        x: { ticks: { color: "#a0afcf", maxRotation: 35, autoSkip: true }, grid: { display: false } }
      }
    }
  });
  
  // Grafik SpO2 dengan sumbu Y 50-110 (sesuai permintaan)
  spo2Chart = new Chart(spo2Ctx, {
    type: "line",
    data: {
      labels: spo2Labels,
      datasets: [{
        label: "Saturasi Oksigen (%)",
        data: spo2Values,
        borderColor: "#4bc0ff",
        backgroundColor: "rgba(75, 192, 255, 0.1)",
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: "#6bc8ff",
        tension: 0.2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: "#cbd5f0" } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        y: { 
          title: { display: true, text: "% SpO₂", color: "#9aa9c9" }, 
          ticks: { color: "#bdc4e0", stepSize: 10 },
          min: 50,    // ← BATAS BAWAH 50
          max: 110,   // ← BATAS ATAS 110
          grid: { color: "rgba(200,212,255,0.08)" } 
        },
        x: { ticks: { color: "#a0afcf", maxRotation: 35, autoSkip: true }, grid: { display: false } }
      }
    }
  });
}

// Update tampilan card
function updateCardValues() {
  hrElement.innerText = (latestHR !== null && !isNaN(latestHR)) ? Math.round(latestHR) : "--";
  spo2Element.innerText = (latestSpO2 !== null && !isNaN(latestSpO2)) ? Math.round(latestSpO2) : "--";
}

// Tambahkan data ke kedua grafik (dengan timestamp yang sama)
function addDataToCharts(hrVal, spo2Val) {
  if (hrVal === null || spo2Val === null) return;
  if (isNaN(hrVal) || isNaN(spo2Val)) return;
  
  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  
  // HR chart
  hrLabels.push(timeLabel);
  hrValues.push(hrVal);
  while (hrLabels.length > MAX_POINTS) { hrLabels.shift(); hrValues.shift(); }
  
  // SpO2 chart
  spo2Labels.push(timeLabel);
  spo2Values.push(spo2Val);
  while (spo2Labels.length > MAX_POINTS) { spo2Labels.shift(); spo2Values.shift(); }
  
  // Update kedua grafik
  if (hrChart) {
    hrChart.data.labels = [...hrLabels];
    hrChart.data.datasets[0].data = [...hrValues];
    hrChart.update("none");
  }
  if (spo2Chart) {
    spo2Chart.data.labels = [...spo2Labels];
    spo2Chart.data.datasets[0].data = [...spo2Values];
    spo2Chart.update("none");
  }
}

// Proses pesan MQTT
function onMessageReceived(topic, message) {
  if (topic !== TOPIC) return;
  try {
    const data = JSON.parse(message.toString());
    let hr = Number(data.hr);
    let spo2 = Number(data.spo2);
    if (isNaN(hr) || isNaN(spo2)) return;
    
    latestHR = hr;
    latestSpO2 = spo2;
    updateCardValues();
    addDataToCharts(latestHR, latestSpO2);
    console.log(`Data: HR=${hr}, SpO2=${spo2}`);
  } catch(err) {
    console.error("JSON parse error:", err);
  }
}

// Status koneksi UI
function setConnectionState(state, msg) {
  statusTextSpan.innerText = msg;
  ledIndicator.className = "led";
  if (state === "connected") ledIndicator.classList.add("connected");
  else if (state === "connecting") ledIndicator.classList.add("connecting");
  else ledIndicator.classList.add("disconnected");
}

// Koneksi MQTT
function connectMQTT() {
  if (client && !client.disconnected) try { client.end(true); } catch(e) {}
  setConnectionState("connecting", "Menghubungkan ke HiveMQ...");
  client = mqtt.connect(broker, options);
  
  client.on("connect", () => {
    console.log("✅ MQTT Terhubung");
    setConnectionState("connected", "Terhubung · subscribe ke topic");
    client.subscribe(TOPIC, { qos: 0 });
  });
  client.on("message", onMessageReceived);
  client.on("reconnect", () => setConnectionState("connecting", "Mencoba reconnect..."));
  client.on("error", (err) => { console.error(err); setConnectionState("disconnected", "Error"); });
  client.on("close", () => setConnectionState("disconnected", "Terputus"));
}

// Mulai
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  connectMQTT();
});
