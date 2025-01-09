const amqp = require('amqplib');
const RABBITMQ_URL = 'amqp://admin:admin@rabbitmq:5672';
const queueName = 'visitas';
const mongoose =require('mongoose');
const MONGO_URL = 'mongodb://admin:admin123@mongodb:27017/Mapa?authSource=admin';
const ipsActivas = [];
mongoose.connect(MONGO_URL)
  .then(() => console.log('Conexión a MongoDB exitosa'))
  .catch((err) => console.error('Error de conexión a MongoDB:', err));


 const ipSchema = new mongoose.Schema({
  index: Number,
  ip: String,
  status: String,
}, { collection: 'userIP' }); // Asocia el esquema con la colección userIP

const IP = mongoose.model('IP', ipSchema);

function detect_ip(){
  fetch('https://ipinfo.io/json?token=58cfb474c004c3') 
  .then(response => response.json())
  .then(data => {
    const loc = data.loc.split(","); 
    const latitude = parseFloat(loc[0]);
    const longitude = parseFloat(loc[1]);
    const city = data.city || "Desconocida";
    const country = data.country || "Desconocido";
    agregarMarcador(latitude, longitude, `
      <div style="text-align: center;">
        <h3 style="margin: 0; color: #333;">${country}</h3>
        <p style="margin: 0;">Ciudad: <b>${city}</b></p>
      </div>
    `);
  });
}
async function ipactives() {
  try {
    const ipsActivas = await IP.find({ status: "active" });
    console.log("IPs activas encontradas:", ipsActivas);
    return ipsActivas;
    
  } catch (err) {
    console.error("Error al buscar IPs activas:", err);
  }
}

setInterval(async () => {
  console.log(`[${new Date().toISOString()}] Ejecutando consulta de IPs activas...`);
  await ipactives();
  ipsActivas.map(ip => ip.ip).forEach(ip => {
    sendtoQueue({ ip, pais: 'Desconocido', ciudad: 'Desconocida' });
  });
}, 2 * 60 * 1000);

async function sendtoQueue(visita) {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel= await connection.createChannel();
        await channel.assertQueue(queueName);
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(visita)));
        console.log('Mensaje enviado:', visita);
        console.log(`Visita enviada a la cola ${queueName}`);
    } catch (error) {
        console.log(error);
    }
    
}

