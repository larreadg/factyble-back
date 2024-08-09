# Usa una imagen base oficial de Node.js
FROM node:20

# Instala curl para usar el script de espera
RUN apt-get update && apt-get install -y curl

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias de la aplicación
RUN npm install

# Copia el resto del código de la aplicación
COPY . .

# Genera el cliente Prisma
RUN npx prisma generate

# Copia el script de espera
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN chmod +x /usr/local/bin/wait-for-it.sh

# Expone el puerto en el que se ejecutará la aplicación
EXPOSE 12100

# Comando para ejecutar la aplicación junto con la migración
CMD ["wait-for-it.sh", "my-mysql-container:3306", "--", "sh", "-c", "npx prisma migrate deploy && npm start"]
