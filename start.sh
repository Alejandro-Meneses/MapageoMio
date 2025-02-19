#!/bin/sh

echo "Script start.sh iniciado."

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

# Verificar si el servidor ya está en ejecución
if pgrep -f "node server.js" > /dev/null; then
  echo "El servidor ya está en ejecución."
else
  echo "Iniciando el servidor (server.js)..."
  node server.js &
  SERVER_PID=$!
fi

sleep 5  # Espera breve para asegurar el inicio del servidor
echo "Iniciando el cliente (send.js)..."
node send.js

# Mantiene el contenedor activo
wait $SERVER_PID
echo "Script start.sh finalizado."