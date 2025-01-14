const amqp = require('amqplib');
const mongoose = require('mongoose');

const RABBITMQ_URL = 'amqp://admin:admin@rabbitmq:5672';
const MONGO_URL = 'mongodb://admin:admin123@mongodb:27017/Mapa?authSource=admin';
const queueName = 'ips_activas';

// Conectar a MongoDB
mongoose.connect(MONGO_URL)
  .then(() => console.log('Conexión a MongoDB exitosa'))
  .catch((err) => console.error('Error de conexión a MongoDB:', err));

const ipSchema = new mongoose.Schema({
  index: Number,
  ip: String,
  lat: Number,
  lon: Number,
  ciudad: String,
  pais: String,
  status: String
}, { collection: 'userIP' }); // Asocia el esquema con la colección userIP

const IP = mongoose.model('IP', ipSchema);

async function ipactives() {
  try {
    const ipsActivas = await IP.find({ status: "active" });
    console.log("IPs activas encontradas:", ipsActivas);

    // Enviar las IPs activas a RabbitMQ
    await sendtoQueue(ipsActivas);

    return ipsActivas;
  } catch (err) {
    console.error("Error al buscar IPs activas:", err);
  }
}

async function sendtoQueue(ipsActivas) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(ipsActivas)));
    console.log('IPs activas enviadas a la cola:', ipsActivas);
  } catch (error) {
    console.log("Error al enviar IPs activas a la cola:", error);
  }
}

// Ejecuta la consulta de IPs activas al inicio del programa
(async () => {
  console.log(`[${new Date().toISOString()}] Ejecutando consulta inicial de IPs activas...`);
  await ipactives();
})();

// Programa la consulta de IPs activas cada 2 minutos
setInterval(async () => {
  console.log(`[${new Date().toISOString()}] Ejecutando consulta periódica de IPs activas...`);
  await ipactives();
}, 5 * 60 * 1000);