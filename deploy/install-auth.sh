#!/bin/bash
# ============================================================
# Скрипт установки сервиса доменной авторизации
# Запуск: sudo bash install-auth.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Установка сервиса авторизации${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: скрипт должен быть запущен от root (sudo)${NC}"
    exit 1
fi

INSTALL_DIR="/opt/carpool"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ============================================================
# 1. Копирование файлов
# ============================================================
echo -e "${YELLOW}[1/5] Копирование файлов auth-сервиса...${NC}"
mkdir -p ${INSTALL_DIR}/auth

if [ -d "${SCRIPT_DIR}/../auth" ]; then
    cp -r ${SCRIPT_DIR}/../auth/* ${INSTALL_DIR}/auth/
    echo -e "${GREEN}  ✓ Файлы скопированы${NC}"
else
    echo -e "${RED}  ✗ Папка auth/ не найдена${NC}"
    exit 1
fi

# ============================================================
# 2. Настройка .env
# ============================================================
echo -e "${YELLOW}[2/5] Настройка конфигурации LDAP...${NC}"

if [ ! -f "${INSTALL_DIR}/auth/.env" ]; then
    cp ${INSTALL_DIR}/auth/.env.example ${INSTALL_DIR}/auth/.env
    
    echo ""
    echo -e "${YELLOW}Настройте параметры LDAP в файле:${NC}"
    echo -e "  ${INSTALL_DIR}/auth/.env"
    echo ""
    echo "Необходимо указать:"
    echo "  - LDAP_URL (адрес контроллера домена)"
    echo "  - LDAP_BASE_DN (базовый DN для поиска)"
    echo "  - DOMAIN (имя домена)"
    echo ""
    read -p "Открыть редактор сейчас? (y/n): " EDIT_NOW
    
    if [ "$EDIT_NOW" = "y" ] || [ "$EDIT_NOW" = "Y" ]; then
        nano ${INSTALL_DIR}/auth/.env
    fi
else
    echo -e "${GREEN}  ✓ .env уже существует${NC}"
fi

# Права на .env
chmod 600 ${INSTALL_DIR}/auth/.env
chown www-data:www-data ${INSTALL_DIR}/auth/.env

# ============================================================
# 3. Создание systemd-сервиса
# ============================================================
echo -e "${YELLOW}[3/5] Создание systemd-сервиса...${NC}"

if [ -f "${SCRIPT_DIR}/carpool-auth.service" ]; then
    cp ${SCRIPT_DIR}/carpool-auth.service /etc/systemd/system/
else
    # Создаём сервис вручную
    cat > /etc/systemd/system/carpool-auth.service << 'EOF'
[Unit]
Description=Carpool Auth Service (LDAP/AD)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/carpool/auth
ExecStart=/usr/local/bin/node auth-server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
fi

echo -e "${GREEN}  ✓ Сервис создан${NC}"

# ============================================================
# 4. Запуск сервиса
# ============================================================
echo -e "${YELLOW}[4/5] Запуск auth-сервиса...${NC}"

systemctl daemon-reload
systemctl enable carpool-auth
systemctl restart carpool-auth

sleep 2

# Проверка
if systemctl is-active --quiet carpool-auth; then
    echo -e "${GREEN}  ✓ Сервис запущен${NC}"
else
    echo -e "${RED}  ✗ Ошибка запуска сервиса${NC}"
    echo -e "${RED}  Проверьте: journalctl -u carpool-auth -n 20${NC}"
    exit 1
fi

# ============================================================
# 5. Проверка работоспособности
# ============================================================
echo -e "${YELLOW}[5/5] Проверка работоспособности...${NC}"

HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null || echo "FAILED")

if echo "$HEALTH" | grep -q '"ok"'; then
    echo -e "${GREEN}  ✓ Auth-сервис отвечает${NC}"
    echo "  $HEALTH"
else
    echo -e "${YELLOW}  ⚠ Auth-сервис не отвечает или LDAP недоступен${NC}"
    echo "  $HEALTH"
    echo ""
    echo -e "${YELLOW}  Проверьте:${NC}"
    echo "  - Подключение к контроллеру домена"
    echo "  - Параметры LDAP в .env"
    echo "  - Логи: journalctl -u carpool-auth -n 20"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Установка завершена!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Следующие шаги:"
echo ""
echo "1. Обновите конфиг Nginx:"
echo "   sudo cp ${SCRIPT_DIR}/nginx-ssl-auth.conf /etc/nginx/sites-available/carpool.conf"
echo "   sudo nano /etc/nginx/sites-available/carpool.conf  # Проверьте параметры"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "2. Проверьте авторизацию:"
echo "   curl -u DOMAIN\\\\username:password http://localhost:3002/auth/me"
echo ""
echo "3. Откройте сайт в браузере:"
echo "   https://carpool.company.local"
echo ""
echo "Полезные команды:"
echo "  sudo systemctl status carpool-auth"
echo "  sudo journalctl -u carpool-auth -f"
echo "  curl http://localhost:3002/health"
echo ""
