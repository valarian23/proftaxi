#!/bin/bash
# ============================================================
# Скрипт установки системы корпоративных поездок
# Целевая ОС: Astra Linux 1.8
# 
# Использование:
#   chmod +x install.sh
#   sudo ./install.sh
#
# Предварительные требования:
#   - PostgreSQL 12+ установлен и запущен
#   - Node.js 18+ установлен (или скачан оффлайн-архив)
#   - Nginx установлен
# ============================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Установка системы корпоративных поездок${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: скрипт должен быть запущен от имени root (sudo)${NC}"
    exit 1
fi

# Директория установки
INSTALL_DIR="/opt/carpool"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ============================================================
# 1. Создание директорий
# ============================================================
echo -e "${YELLOW}[1/7] Создание директорий...${NC}"
mkdir -p ${INSTALL_DIR}/{frontend,backend,database,deploy}

# ============================================================
# 2. Копирование файлов фронтенда
# ============================================================
echo -e "${YELLOW}[2/7] Копирование фронтенда...${NC}"
# Предполагается, что dist/ уже собран на машине с интернетом
# и перенесён в папку deploy/dist/
if [ -d "${SCRIPT_DIR}/dist" ]; then
    cp -r ${SCRIPT_DIR}/dist/* ${INSTALL_DIR}/frontend/dist/
    echo -e "${GREEN}  Фронтенд скопирован${NC}"
else
    echo -e "${YELLOW}  Папка dist/ не найдена. Скопируйте результат сборки вручную в ${INSTALL_DIR}/frontend/dist/${NC}"
fi

# ============================================================
# 3. Копирование бэкенда
# ============================================================
echo -e "${YELLOW}[3/7] Установка бэкенда...${NC}"
cp -r ${SCRIPT_DIR}/../backend/* ${INSTALL_DIR}/backend/

# Копируем node_modules (должны быть скачаны заранее на Windows)
if [ -d "${SCRIPT_DIR}/../backend/node_modules" ]; then
    cp -r ${SCRIPT_DIR}/../backend/node_modules ${INSTALL_DIR}/backend/
    echo -e "${GREEN}  node_modules скопированы${NC}"
else
    echo -e "${YELLOW}  Папка node_modules не найдена.${NC}"
    echo -e "${YELLOW}  Выполните на машине с интернетом: cd backend && npm install${NC}"
    echo -e "${YELLOW}  Затем скопируйте node_modules на сервер.${NC}"
fi

# ============================================================
# 4. Настройка базы данных PostgreSQL
# ============================================================
echo -e "${YELLOW}[4/7] Настройка PostgreSQL...${NC}"

# Запрос пароля
read -sp "Введите пароль для пользователя carpool_user в PostgreSQL: " DB_PASSWORD
echo ""

# Создание пользователя и БД
sudo -u postgres psql -c "CREATE USER carpool_user WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || \
    echo -e "${YELLOW}  Пользователь carpool_user уже существует${NC}"

sudo -u postgres psql -c "CREATE DATABASE carpool OWNER carpool_user;" 2>/dev/null || \
    echo -e "${YELLOW}  База данных carpool уже существует${NC}"

# Выполнение скрипта инициализации
sudo -u postgres psql -d carpool -f ${INSTALL_DIR}/database/init.sql 2>/dev/null || \
    sudo -u postgres psql -d carpool -f ${SCRIPT_DIR}/../database/init.sql

# Создание .env файла для бэкенда
cat > ${INSTALL_DIR}/backend/.env << EOF
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=carpool
DB_USER=carpool_user
DB_PASSWORD=${DB_PASSWORD}
EOF

echo -e "${GREEN}  База данных настроена${NC}"

# ============================================================
# 5. Настройка Nginx
# ============================================================
echo -e "${YELLOW}[5/7] Настройка Nginx...${NC}"

# Копирование конфигурации
cp ${INSTALL_DIR}/deploy/nginx.conf /etc/nginx/sites-available/carpool.conf 2>/dev/null || \
    cp ${SCRIPT_DIR}/nginx.conf /etc/nginx/sites-available/carpool.conf

# Создание symlink
ln -sf /etc/nginx/sites-available/carpool.conf /etc/nginx/sites-enabled/carpool.conf

# Запрос доменного имени
read -p "Введите доменное имя сервера (например, carpool.company.local): " SERVER_NAME
sed -i "s/carpool.your-company.local/${SERVER_NAME}/g" /etc/nginx/sites-available/carpool.conf

# Проверка конфигурации
nginx -t

echo -e "${GREEN}  Nginx настроен${NC}"

# ============================================================
# 6. Создание systemd-сервиса для бэкенда
# ============================================================
echo -e "${YELLOW}[6/7] Создание systemd-сервиса...${NC}"

# Определяем путь к node
NODE_PATH=$(which node 2>/dev/null || echo "/usr/local/bin/node")

cat > /etc/systemd/system/carpool-backend.service << EOF
[Unit]
Description=Carpool Backend API Server
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=${INSTALL_DIR}/backend
ExecStart=${NODE_PATH} server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable carpool-backend

echo -e "${GREEN}  Сервис создан и включён${NC}"

# ============================================================
# 7. Запуск сервисов
# ============================================================
echo -e "${YELLOW}[7/7] Запуск сервисов...${NC}"

systemctl restart carpool-backend
systemctl restart nginx

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Установка завершена!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Приложение доступно по адресу: http://${SERVER_NAME}"
echo ""
echo "Полезные команды:"
echo "  systemctl status carpool-backend  — статус бэкенда"
echo "  journalctl -u carpool-backend -f  — логи бэкенда"
echo "  systemctl restart nginx           — перезапуск Nginx"
echo ""
echo -e "${YELLOW}Важно:${NC} Для полноценной NTLM-авторизации необходимо"
echo "дополнительно настроить модуль аутентификации Nginx"
echo "(см. комментарии в /etc/nginx/sites-available/carpool.conf)"
