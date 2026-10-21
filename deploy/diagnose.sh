#!/bin/bash
# ============================================================
# Скрипт диагностики проблемы 500 в Nginx
# Запуск: sudo bash diagnose.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} Диагностика ошибки 500 в Nginx${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================
# 1. Проверка конфигурации Nginx
# ============================================================
echo -e "${YELLOW}[1/8] Проверка конфигурации Nginx...${NC}"
if nginx -t 2>&1; then
    echo -e "${GREEN}  ✓ Конфигурация Nginx корректна${NC}"
else
    echo -e "${RED}  ✗ Ошибка в конфигурации Nginx!${NC}"
    echo -e "${RED}  Выполните: sudo nginx -t${NC}"
fi
echo ""

# ============================================================
# 2. Проверка SSL-сертификатов
# ============================================================
echo -e "${YELLOW}[2/8] Проверка SSL-сертификатов...${NC}"

# Извлекаем пути из конфига
CERT_PATH=$(grep -oP 'ssl_certificate\s+\K\S+' /etc/nginx/sites-available/carpool.conf 2>/dev/null | tr -d ';')
KEY_PATH=$(grep -oP 'ssl_certificate_key\s+\K\S+' /etc/nginx/sites-available/carpool.conf 2>/dev/null | tr -d ';')

if [ -n "$CERT_PATH" ]; then
    echo -e "  Путь к сертификату: ${CERT_PATH}"
    if [ -f "$CERT_PATH" ]; then
        echo -e "${GREEN}  ✓ Сертификат найден${NC}"
        # Проверяем срок действия
        EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" 2>/dev/null || echo "не удалось прочитать")
        echo -e "  Срок действия: $EXPIRY"
    else
        echo -e "${RED}  ✗ Сертификат НЕ НАЙДЕН по пути: $CERT_PATH${NC}"
        echo -e "${RED}  Это вероятная причина ошибки 500!${NC}"
    fi
else
    echo -e "${RED}  ✗ Путь к сертификату не найден в конфиге${NC}"
fi

if [ -n "$KEY_PATH" ]; then
    echo -e "  Путь к ключу: ${KEY_PATH}"
    if [ -f "$KEY_PATH" ]; then
        echo -e "${GREEN}  ✓ Ключ найден${NC}"
        # Проверяем права доступа
        KEY_PERMS=$(stat -c %a "$KEY_PATH" 2>/dev/null)
        if [ "$KEY_PERMS" = "600" ] || [ "$KEY_PERMS" = "640" ]; then
            echo -e "${GREEN}  ✓ Права на ключ корректны ($KEY_PERMS)${NC}"
        else
            echo -e "${YELLOW}  ⚠ Права на ключ: $KEY_PERMS (рекомендуется 600 или 640)${NC}"
        fi
    else
        echo -e "${RED}  ✗ Ключ НЕ НАЙДЕН по пути: $KEY_PATH${NC}"
    fi
else
    echo -e "${RED}  ✗ Путь к ключу не найден в конфиге${NC}"
fi
echo ""

# ============================================================
# 3. Проверка портов
# ============================================================
echo -e "${YELLOW}[3/8] Проверка слушающих портов...${NC}"
echo -e "  Nginx:"
ss -tlnp | grep -E ':(80|443)\s' | sed 's/^/    /'
echo -e "  Бэкенд (порт 5123):"
if ss -tlnp | grep -q ':5123\s'; then
    echo -e "${GREEN}  ✓ Бэкенд слушает на порту 5123${NC}"
else
    echo -e "${RED}  ✗ Бэкенд НЕ слушает на порту 5123${NC}"
    echo -e "  Проверьте: sudo systemctl status carpool-backend"
fi
echo ""

# ============================================================
# 4. Проверка бэкенда
# ============================================================
echo -e "${YELLOW}[4/8] Проверка бэкенда...${NC}"
HEALTH=$(curl -s http://localhost:5123/api/health 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q '"ok"'; then
    echo -e "${GREEN}  ✓ Бэкенд отвечает: $HEALTH${NC}"
else
    echo -e "${RED}  ✗ Бэкенд не отвечает: $HEALTH${NC}"
fi
echo ""

# ============================================================
# 5. Проверка прав на файлы фронтенда
# ============================================================
echo -e "${YELLOW}[5/8] Проверка файлов фронтенда...${NC}"
FRONTEND_DIR="/opt/carpool/frontend/dist"
if [ -d "$FRONTEND_DIR" ]; then
    echo -e "${GREEN}  ✓ Директория фронтенда существует${NC}"
    if [ -f "$FRONTEND_DIR/index.html" ]; then
        echo -e "${GREEN}  ✓ index.html найден${NC}"
    else
        echo -e "${RED}  ✗ index.html НЕ найден в $FRONTEND_DIR${NC}"
    fi
    # Проверяем права
    OWNER=$(stat -c %U "$FRONTEND_DIR" 2>/dev/null)
    echo -e "  Владелец: $OWNER"
    # Nginx обычно работает от www-data
    if [ "$OWNER" != "www-data" ] && [ "$OWNER" != "nginx" ]; then
        echo -e "${YELLOW}  ⚠ Проверьте, что nginx имеет доступ к файлам${NC}"
    fi
else
    echo -e "${RED}  ✗ Директория фронтенда НЕ найдена: $FRONTEND_DIR${NC}"
fi
echo ""

# ============================================================
# 6. Проверка Squid
# ============================================================
echo -e "${YELLOW}[6/8] Проверка Squid (авторизация)...${NC}"
if systemctl is-active --quiet squid 2>/dev/null; then
    echo -e "${GREEN}  ✓ Squid запущен${NC}"
    if ss -tlnp | grep -q ':3128\s'; then
        echo -e "${GREEN}  ✓ Squid слушает на порту 3128${NC}"
    else
        echo -e "${YELLOW}  ⚠ Squid запущен, но не слушает на 3128${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Squid не запущен (если используется auth_request — это проблема)${NC}"
fi
echo ""

# ============================================================
# 7. Последние ошибки из логов Nginx
# ============================================================
echo -e "${YELLOW}[7/8] Последние ошибки из логов Nginx...${NC}"
echo -e "  Error log (последние 10 строк):"
if [ -f /var/log/nginx/carpool_error.log ]; then
    tail -10 /var/log/nginx/carpool_error.log 2>/dev/null | sed 's/^/    /'
elif [ -f /var/log/nginx/error.log ]; then
    tail -10 /var/log/nginx/error.log 2>/dev/null | sed 's/^/    /'
else
    echo -e "  Логи не найдены"
fi
echo ""

# ============================================================
# 8. Тестовые запросы
# ============================================================
echo -e "${YELLOW}[8/8] Тестовые запросы...${NC}"

echo -e "  HTTP (порт 80):"
HTTP_RESULT=$(curl -sI http://localhost/ 2>&1 | head -1)
echo -e "    $HTTP_RESULT"

echo -e "  HTTPS (порт 443, с проверкой сертификата):"
HTTPS_RESULT=$(curl -skI https://localhost/ 2>&1 | head -1)
echo -e "    $HTTPS_RESULT"

echo -e "  HTTPS (порт 443, без проверки сертификата):"
HTTPS_RESULT2=$(curl -skI https://localhost/ 2>&1 | head -1)
echo -e "    $HTTPS_RESULT2"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} Диагностика завершена${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Частые причины ошибки 500:${NC}"
echo ""
echo "1. SSL-сертификат не найден или имеет неверный путь"
echo "   → Проверьте пути ssl_certificate и ssl_certificate_key"
echo ""
echo "2. Nginx не может прочитать файл сертификата (права доступа)"
echo "   → chmod 644 /etc/ssl/certs/carpool.crt"
echo "   → chmod 600 /etc/ssl/private/carpool.key"
echo "   → chown root:root /etc/ssl/private/carpool.key"
echo ""
echo "3. auth_request с Squid возвращает ошибку"
echo "   → Проверьте конфиг Squid и логи"
echo "   → Временно закомментируйте auth_request для теста"
echo ""
echo "4. Конфликт: listen 443 ssl, но запрос идёт по HTTP"
echo "   → Используйте https:// в браузере"
echo ""
echo -e "${YELLOW}Для временной диагностики отключите auth_request:${NC}"
echo "  # Закомментируйте строки auth_request в конфиге"
echo "  sudo nano /etc/nginx/sites-available/carpool.conf"
echo "  sudo nginx -t && sudo systemctl reload nginx"
