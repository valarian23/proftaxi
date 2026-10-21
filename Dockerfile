# ============================================================
# Dockerfile для бэкенда системы совместных поездок
# Используется если на сервере Astra Linux установлен Docker
# ============================================================

FROM node:20-alpine

WORKDIR /app

# Копирование зависимостей
COPY backend/package.json backend/package-lock.json* ./

# Установка зависимостей (только production)
RUN npm ci --only=production 2>/dev/null || npm install --only=production

# Копирование исходного кода
COPY backend/server.js ./

# Создание непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S carpool -u 1001 -G nodejs

USER carpool

EXPOSE 5123

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5123/api/health || exit 1

CMD ["node", "server.js"]
