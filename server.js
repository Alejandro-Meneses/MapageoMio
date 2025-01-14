const amqp = require('amqplib');
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');

const RABBITMQ_URL = 'amqp://admin:admin@rabbitmq:5672';
const queueName = 'ips_activas';
const app = express();
const PORT = 3000;

// Conexión a MongoDB
const MONGO_URL = 'mongodb://admin:admin123@mongodb:27017/Mapa?authSource=admin';
mongoose.connect(MONGO_URL)
  .then(() => console.log('Conexión a MongoDB exitosa'))
  .catch((err) => console.error('Error de conexión a MongoDB:', err));

const ipSchema = new mongoose.Schema({
  ip: String,
  lat: Number,
  lon: Number,
  ciudad: String,
  pais: String,
  status: { type: String, default: 'active' },
  timestamp: { type: Date, default: Date.now }
}, { collection: 'userIP' });

const IP = mongoose.model('IP', ipSchema);

// Middleware para analizar el cuerpo de las solicitudes
app.use(bodyParser.json());

// Servir archivos estáticos desde la carpeta raíz
app.use(express.static(__dirname));

// Ruta principal para index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para guardar la IP detectada en MongoDB
app.post('/save-ip', async (req, res) => {
  try {
    const visita = new IP(req.body);
    await visita.save();
    // Enviar la información a RabbitMQ después de guardarla en MongoDB
    await sendtoQueue(visita);
    res.status(201).send('IP guardada correctamente');
  } catch (error) {
    console.error('Error al guardar la IP en MongoDB:', error);
    res.status(500).send('Error al guardar la IP');
  }
});

// Función para enviar mensajes a RabbitMQ
async function sendtoQueue(visita) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(visita)));
    console.log('Mensaje enviado:', visita);
    console.log(`Visita enviada a la cola ${queueName}`);
  } catch (error) {
    console.log('Error al enviar mensaje a la cola:', error);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});

// Crear un servidor WebSocket
const wss = new WebSocket.Server({ port: 8080 });

// Consumir mensajes de RabbitMQ y retransmitir por WebSocket
async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);

    console.log(`Esperando mensajes en la cola "${queueName}"...`);

    channel.consume(queueName, (message) => {
      if (message !== null) {
        const visita = JSON.parse(message.content.toString());
        console.log('IPs activas recibidas:', visita);

        // Enviar las IPs activas a todos los clientes WebSocket conectados
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(visita));
          }
        });

        channel.ack(message); // Confirmar el mensaje como procesado
      }
    });
  } catch (error) {
    console.error('Error al consumir mensajes:', error);
  }
}

startConsumer();