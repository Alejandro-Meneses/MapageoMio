const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;
const WS_PORT = 8080;

const RABBITMQ_URL = 'amqp://admin:admin@rabbitmq:5672';
const queueName = 'ips_activas';

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
  status: String
}, { collection: 'userIP' });

const IP = mongoose.model('IP', ipSchema);

// Ruta para servir el archivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para manejar las visitas
app.post('/api/visitas', async (req, res) => {
  try {
    const { ip, lat, lon, ciudad, pais, status } = req.body;

    // Verificar si la IP ya existe en MongoDB
    const existe = await IP.findOne({ ip });
    if (existe) {
      return res.status(200).json({ message: 'La IP ya existe en la base de datos' });
    }

    // Crear y guardar una nueva entrada en MongoDB
    const nuevaVisita = new IP({ ip, lat, lon, ciudad, pais, status });
    await nuevaVisita.save();

    console.log(`Nueva visita guardada: ${ip}`);
    res.status(201).json({ message: 'Visita almacenada con éxito' });
  } catch (error) {
    console.error('Error al procesar visita:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Servidor WebSocket para actualizaciones en tiempo real
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('Nuevo cliente WebSocket conectado');

  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

// Función para retransmitir datos de RabbitMQ a WebSocket
async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);

    console.log(`Esperando mensajes en la cola "${queueName}"...`);

    channel.consume(queueName, (message) => {
      if (message !== null) {
        const ipsActivas = JSON.parse(message.content.toString());
        console.log('IPs activas recibidas de RabbitMQ:', ipsActivas);

        // Enviar las IPs activas a todos los clientes WebSocket conectados
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(ipsActivas));
          }
        });

        channel.ack(message); // Confirmar el mensaje como procesado
      }
    });
  } catch (error) {
    console.error('Error al consumir mensajes de RabbitMQ:', error);
  }
}

// Iniciar el consumidor de RabbitMQ
startConsumer();

// Iniciar el servidor HTTP
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
