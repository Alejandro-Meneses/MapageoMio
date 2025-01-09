const amqp = require('amqplib');
const WebSocket = require('ws');

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
module.exports = { detect_ip };
startConsumer();
