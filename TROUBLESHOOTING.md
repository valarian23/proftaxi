# Исправление ошибки 500 в Nginx (SSL + Squid)

## Симптомы

- `curl http://localhost:5123/api/health` → `{"status":"ok","database":"connected"}` ✓
- `curl -I http://localhost/` → **500 Internal Server Error** ✗
- Сайт открывается с ошибкой 500 из сети

## Наиболее вероятные причины

### 1. SSL-сертификат не найден или неверный путь

**Симптом:** В error.log Nginx будут строки:
```
cannot load certificate "/etc/ssl/certs/carpool.crt": BIO_new_file() failed
```

**Решение:**

```bash
# Проверьте, какие пути указаны в конфиге
grep ssl_certificate /etc/nginx/sites-available/carpool.conf

# Убедитесь, что файлы существуют
ls -la /etc/ssl/certs/carpool.crt
ls -la /etc/ssl/private/carpool.key

# Если файлы в другом месте — исправьте пути в конфиге
sudo nano /etc/nginx/sites-available/carpool.conf
```

### 2. Права доступа к SSL-ключу

**Симптом:** В error.log:
```
cannot load certificate key "/etc/ssl/private/carpool.key": Permission denied
```

**Решение:**

```bash
# Nginx запускается от root (master) и www-data (worker)
# Ключ должен быть доступен root

sudo chown root:root /etc/ssl/private/carpool.key
sudo chmod 600 /etc/ssl/private/carpool.key

# Сертификат может быть доступен всем на чтение
sudo chown root:root /etc/ssl/certs/carpool.crt
sudo chmod 644 /etc/ssl/certs/carpool.crt

# Перезагрузка Nginx
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Запрос по HTTP на HTTPS-порт

**Симптом:** Вы делаете `curl http://localhost/`, но Nginx слушает 443 с SSL.

**Решение:**

```bash
# Правильный запрос — через HTTPS
curl -kI https://localhost/

# Или добавьте редирект с 80 на 443 в конфиге Nginx
```

### 4. Ошибка в auth_request (Squid)

**Симптом:** В error.log:
```
auth request unexpected status '500' while sending to client
```

**Решение (для диагностики):**

```bash
# Временно отключите auth_request
sudo nano /etc/nginx/sites-available/carpool.conf

# Закомментируйте строки auth_request:
#   auth_request /auth-ntlm;
#   location = /auth-ntlm { ... }

# Проверьте и перезагрузите
sudo nginx -t && sudo systemctl reload nginx

# Если сайт заработал — проблема в Squid
# Проверьте конфиг Squid:
sudo cat /etc/squid/squid.conf
sudo systemctl status squid
sudo tail -20 /var/log/squid/access.log
```

### 5. Порт бэкенда не обновлён в Nginx

**Симптом:** Nginx пытается проксировать на порт 3001, а бэкенд на 5123.

**Решение:**

```bash
# Проверьте upstream в конфиге Nginx
grep -A2 'upstream carpool_backend' /etc/nginx/sites-available/carpool.conf

# Должно быть:
# upstream carpool_backend {
#     server 127.0.0.1:5123;
# }

# Если порт 3001 — исправьте:
sudo nano /etc/nginx/sites-available/carpool.conf
# Замените server 127.0.0.1:3001 на server 127.0.0.1:5123

sudo nginx -t && sudo systemctl reload nginx
```

## Пошаговая диагностика

### Шаг 1. Запустите скрипт диагностики

```bash
sudo bash diagnose.sh
```

### Шаг 2. Проверьте логи Nginx

```bash
# Последние ошибки
sudo tail -30 /var/log/nginx/carpool_error.log

# Или общий error.log
sudo tail -30 /var/log/nginx/error.log
```

### Шаг 3. Проверьте конфиг Nginx

```bash
sudo nginx -t
```

### Шаг 4. Временно упростите конфиг для теста

Создайте минимальный конфиг без SSL и авторизации:

```bash
sudo cp /etc/nginx/sites-available/carpool.conf /etc/nginx/sites-available/carpool.conf.bak

sudo tee /etc/nginx/sites-available/carpool.conf << 'EOF'
upstream carpool_backend {
    server 127.0.0.1:5123;
}

server {
    listen 80;
    server_name _;

    root /opt/carpool/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://carpool_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx
```

Если после этого сайт заработает по HTTP — проблема в SSL или auth_request.

### Шаг 5. Проверьте SSL отдельно

```bash
# Тест SSL-соединения
openssl s_client -connect localhost:443 -servername carpool.your-company.local

# Проверка сертификата
openssl x509 -in /etc/ssl/certs/carpool.crt -text -noout
```

### Шаг 6. Проверьте Squid

```bash
# Статус Squid
sudo systemctl status squid

# Логи Squid
sudo tail -20 /var/log/squid/access.log
sudo tail -20 /var/log/squid/cache.log

# Тест NTLM-авторизации через Squid
curl -v --ntlm -u DOMAIN\\username:password http://localhost:3128/
```

## Правильная конфигурация Nginx (SSL + Squid)

См. файл `deploy/nginx-ssl.conf` — полная рабочая конфигурация.

Ключевые моменты:

1. **Два server-блока:** редирект 80→443 и основной HTTPS
2. **SSL-сертификаты:** правильные пути и права доступа
3. **Upstream:** порт 5123 (ваш бэкенд)
4. **auth_request:** закомментируйте для теста, включите после проверки Squid
5. **X-Remote-User:** настройте передачу имени пользователя от Squid

## Восстановление после исправления

```bash
# 1. Проверка конфига
sudo nginx -t

# 2. Перезагрузка
sudo systemctl reload nginx

# 3. Проверка
curl -kI https://localhost/
# Ожидается: HTTP/2 200

# 4. Проверка из браузера
# Откройте https://carpool.your-company.local
```

## Чек-лист

- [ ] Пути к SSL-сертификату и ключу корректны
- [ ] Права на ключ: `600`, владелец `root:root`
- [ ] Права на сертификат: `644`, владелец `root:root`
- [ ] В upstream указан порт `5123`
- [ ] `nginx -t` проходит без ошибок
- [ ] Бэкенд отвечает: `curl http://localhost:5123/api/health`
- [ ] auth_request закомментирован для теста (или Squid работает)
- [ ] В браузере используется `https://`

## Если ничего не помогло

```bash
# Полная диагностика
sudo bash diagnose.sh

# Логи в реальном времени
sudo tail -f /var/log/nginx/error.log

# В другом терминале — запрос
curl -kI https://localhost/
```
