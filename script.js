const broker = "wss://801aa7276cf24c3881064f8513f377c6.s1.eu.hivemq.cloud:8884/mqtt"; 
// jika HiveMQ Cloud gunakan:
// wss://xxxx.s1.eu.hivemq.cloud:8884/mqtt

const options = {
  username: "heart_rate",
  password: "@Barokibnul725"
};

const client = mqtt.connect(broker, options);

client.on("connect", () => {
  console.log("Connected to MQTT");
  client.subscribe("health/monitor/data");
});

client.on("message", (topic, message) => {
  const data = JSON.parse(message.toString());

  document.getElementById("hr").innerText = data.hr;
  document.getElementById("spo2").innerText = data.spo2;
});