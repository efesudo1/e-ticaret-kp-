# ---------- Build aşaması ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time env (compose'tan geçilir): VITE_API_BASE=/api gibi
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# ---------- Çalışma aşaması (nginx) ----------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
