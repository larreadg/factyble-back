# Usa una imagen base oficial de Node.js con Alpine Linux
FROM node:20-alpine

# Instala OpenJDK 8, Python 3, make, g++, bash, OpenSSL (requerido por el motor nativo de Prisma) y tzdata
RUN apk add --no-cache openjdk8 python3 make g++ bash openssl tzdata

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Establece la variable de entorno JAVA_HOME
ENV JAVA_HOME=/usr/lib/jvm/java-1.8-openjdk
ENV PATH=$JAVA_HOME/bin:$PATH

# Fuerza el huso horario usado para SIFEN. Necesario porque la librería vendorizada
# facturacionelectronicapy-xmlsign estampa el campo dFecFirma del DE con new Date()
# usando getters locales (no UTC, no dayjs.tz), a diferencia de xmlBuilderService.js/cdc.js
# que sí convierten explícitamente (ver AUD-002, MIGRATION_PLAN.md).
# Sin esto, dFecFirma queda en hora UTC y SIFEN la rechaza como "adelantada" (código 1004).
# Se usa America/Argentina/Buenos_Aires en vez de America/Asuncion: mismo offset real (-03:00,
# oficial en Paraguay desde 2024) pero sin las reglas históricas de DST de la entrada de tzdata
# de Asunción, que han dado horas incorrectas.
ENV TZ=America/Argentina/Buenos_Aires

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
EXPOSE 8000

# Comando para ejecutar la aplicación junto con la migración
# CMD ["bash", "/usr/local/bin/wait-for-it.sh", "factyble-mysql:3306", "--", "sh", "-c", "npx prisma migrate deploy && npm start"]
# Comando para ejecutar la aplicación junto con la migración y verificar el valor de DATABASE_URL
CMD ["sh", "-c", "echo 'DATABASE_URL=' $DATABASE_URL && /usr/local/bin/wait-for-it.sh mysql:3306 -- sh -c 'npx prisma migrate deploy && npm start'"]
