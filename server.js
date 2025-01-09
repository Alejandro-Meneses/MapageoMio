const amqp = require('amqplib');
const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const net = require('net');

const RABBITMQ_URL = 'amqp://admin:admin@rabbitmq:5672';
const queueName = 'visitas';
const app = express();
const PORT = 3000;
const WS_PORT = 8080;

// Función para verificar si el puerto está en uso
function isPortInUse(port, callback) {
  const server = net.createServer(socket => {
    socket.write('Echo server\r\n');
    socket.pipe(socket);
  });

  server.listen(port, '127.0.0.1');
  server.on('error', () => {
    callback(true);
  });
  server.on('listening', () => {
    server.close();
    callback(false);
  });
}

isPortInUse(PORT, inUse => {
  if (inUse) {
    console.error(`Error: El puerto ${PORT} ya está en uso`);
    process.exit(1);
  } else {
    app.use(express.static(__dirname));
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor HTTP corriendo en http://0.0.0.0:${PORT}`);
    });

    isPortInUse(WS_PORT, inUse => {
      if (inUse) {
        console.error(`Error: El puerto ${WS_PORT} ya está en uso`);
        process.exit(1);
      } else {
        const wss = new WebSocket.Server({ port: WS_PORT });
        console.log(`Servidor WebSocket iniciado en el puerto ${WS_PORT}`);

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

                wss.clients.forEach(client => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(visita));
                  }
                });

                channel.ack(message);
              }
            });
          } catch (error) {
            console.error('Error al consumir mensajes:', error);
          }
        }

        startConsumer();
      }
    });
  }
});