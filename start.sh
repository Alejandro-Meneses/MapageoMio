#!/bin/sh

# Espera a que RabbitMQ esté listo
echo "Esperando a que RabbitMQ esté listo..."
while ! nc -z rabbitmq 5672; do
  echo "RabbitMQ no está listo. Esperando..."
  sleep 10
done
echo "RabbitMQ está activo."

# Espera a que MongoDB esté listo
echo "Esperando a que MongoDB esté listo..."
while ! nc -z mongodb 27017; do
  echo "MongoDB no está listo. Esperando..."
  sleep 10
done
echo "MongoDB está activo."

# Inicia server.js y luego send.js
echo "Iniciando el servidor..."
node server.js &
SERVER_PID=$!

sleep 5  # Espera breve para asegurar el inicio del servidor
echo "Iniciando el cliente (send.js)..."
node send.js

# Mantiene el contenedor activo
wait $SERVER_PID
