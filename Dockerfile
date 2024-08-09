# Usa una imagen base oficial de Node.js con Alpine Linux
FROM node:20-alpine

# Instala OpenJDK 8, Python 3, make, g++, y bash
RUN apk add --no-cache openjdk8 python3 make g++ bash

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Establece la variable de entorno JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-1.8-openjdk
ENV PATH=$JAVA_HOME/bin:$PATH

# Asegura que Python esté disponible para node-gyp
ENV PYTHON=/usr/bin/python3

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias de la aplicación
RUN npm install --build-from-source

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
# CMD ["bash", "/usr/local/bin/wait-for-it.sh", "factyble-mysql:3306", "--", "sh", "-c", "npx prisma migrate deploy && npm start"]
# Comando para ejecutar la aplicación junto con la migración y verificar el valor de DATABASE_URL
CMD ["sh", "-c", "echo 'DATABASE_URL=' $DATABASE_URL && /usr/local/bin/wait-for-it.sh factyble-mysql:3306 -- sh -c 'npx prisma migrate deploy && npm start'"]
