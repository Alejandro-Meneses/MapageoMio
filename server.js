const amqp = require('amqplib');
const WebSocket = require('ws');
const fetch = require('node-fetch'); // Importar node-fetch para realizar peticiones HTTP

const RABBITMQ_URL = 'amqp://admin:admin@rabbitmq:5672';
const queueName = 'visitas';

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Servir archivos estáticos desde la carpeta raíz
app.use(express.static(__dirname));

// Ruta principal para index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});

// Crear un servidor WebSocket
const wss = new WebSocket.Server({ port: 8080 });

// Función para detectar la IP y enviar la información a RabbitMQ
async function detect_ip() {
  try {
    const response = await fetch('https://ipinfo.io/json?token=58cfb474c004c3');
    const data = await response.json();
    const loc = data.loc.split(",");
    const latitude = parseFloat(loc[0]);
    const longitude = parseFloat(loc[1]);
    const city = data.city || "Desconocida";
    const country = data.country || "Desconocido";

    const visita = {
      lat: latitude,
      lon: longitude,
      pais: country,
      ciudad: city
    };

    await sendtoQueue(visita);
  } catch (error) {
    console.error('Error al detectar IP:', error);
  }
}

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
        console.log('Mensaje recibido:', visita);

        // Enviar el mensaje a todos los clientes WebSocket conectados
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

// Llamar a la función detect_ip para iniciar el proceso
detect_ip();