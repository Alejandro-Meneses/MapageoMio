const mongoose = require('mongoose');
const express = require('express');
const amqp = require('amqplib');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;
const WS_PORT = 8080;

const RABBITMQ_URL = 'amqp://admin:admin@rabbitmq:5672';
const queueName = 'ips_activas';
const deleteQueue = 'eliminar_visitas';

// Configuración de Express
app.use(express.json());
app.use(express.static(__dirname));

// Conexión a MongoDB
const MONGO_URL = 'mongodb://admin:admin123@mongodb:27017/Mapa?authSource=admin';
mongoose.connect(MONGO_URL)
  .then(() => console.log('Conexión a MongoDB exitosa'))
  .catch(err => console.error('Error de conexión a MongoDB:', err));

// Esquema de la colección MongoDB
const ipSchema = new mongoose.Schema({
  ip: String,
  lat: Number,
  lon: Number,
  ciudad: String,
  pais: String,
  timestamp: String
}, { collection: 'userIP' });

const IP = mongoose.model('IP', ipSchema);

// Ruta para manejar las visitas
app.post('/api/visitas', async (req, res) => {
  try {
    const { ip, lat, lon, ciudad, pais, timestamp } = req.body;

    // Verificar si la IP ya existe en MongoDB
    const existe = await IP.findOne({ ip });
    if (existe) {
      return res.status(200).json({ message: 'La IP ya existe en la base de datos' });
    }

    // Crear y guardar una nueva entrada en MongoDB
    const nuevaVisita = new IP({ ip, lat, lon, ciudad, pais, timestamp });
    await nuevaVisita.save();

    console.log(`Nueva visita guardada: ${ip}`);
    res.status(201).json({ message: 'Visita almacenada con éxito' });

    // Publicar un mensaje en RabbitMQ para retransmitir datos por WebSocket
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify([nuevaVisita])));

    // Publicar un mensaje en RabbitMQ para eliminación programada
    const delay = 5 * 60 * 1000; // 5 minutos
    await channel.assertQueue(deleteQueue, { durable: true });
    channel.sendToQueue(deleteQueue, Buffer.from(JSON.stringify({ ip })), {
      headers: { 'x-delay': delay },
    });
    console.log(`Mensaje enviado a RabbitMQ para eliminar IP: ${ip} en 5 minutos`);
  } catch (error) {
    console.error('Error al procesar visita:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Servidor WebSocket para actualizaciones en tiempo real
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('Nuevo cliente WebSocket conectado');
  ws.on('close', () => console.log('Cliente WebSocket desconectado'));
});

// Consumidor para retransmitir datos a WebSocket
async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);

    console.log(`Esperando mensajes en la cola "${queueName}"...`);

    channel.consume(queueName, (message) => {
      if (message !== null) {
        const ipsActivas = JSON.parse(message.content.toString());
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(ipsActivas));
          }
        });
        channel.ack(message);
      }
    });
  } catch (error) {
    console.error('Error al consumir mensajes de RabbitMQ:', error);
  }
}

// Consumidor para manejar eliminaciones
async function startDeleteConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(deleteQueue, {
      arguments: {
        'x-message-ttl': 300000 // 5 minutos en milisegundos
      }
    });    console.log(`Esperando mensajes en la cola "${deleteQueue}" para eliminaciones...`);

    channel.consume(deleteQueue, async (msg) => {
      if (msg !== null) {
        const { ip } = JSON.parse(msg.content.toString());
        try {
          const eliminado = await IP.deleteOne({ ip });
          if (eliminado.deletedCount > 0) {
            console.log(`Visita eliminada: ${ip}`);
          } else {
            console.log(`No se encontró la visita para eliminar: ${ip}`);
          }
        } catch (error) {
          console.error(`Error al eliminar la visita (${ip}):`, error);
        }
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Error al iniciar el consumidor de RabbitMQ:', error);
  }
}

// Iniciar los consumidores
startConsumer();
startDeleteConsumer();

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
