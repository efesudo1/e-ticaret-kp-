FROM node:20-alpine

WORKDIR /app

# package*.json önce kopyalanır → katman cache'i daha verimli
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Uygulama kodu
COPY . .

# uploads klasörü (multer için)
RUN mkdir -p /app/uploads /app/logs

# Non-root kullanıcı
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000

# Healthcheck — /api/health endpoint zaten mevcut
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]
