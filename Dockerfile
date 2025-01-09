# Usa una imagen de Node.js ligera
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia el archivo package.json y package-lock.json
COPY package*.json ./

# Instala dependencias (forzar instalación limpia si es necesario)
RUN npm install --production

# Copia el resto del código fuente
COPY . .

# Copia y prepara el script start.sh
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expone el puerto 3000
EXPOSE 3000

EXPOSE 8080

# Ejecuta el script start.sh
CMD ["/start.sh"]
