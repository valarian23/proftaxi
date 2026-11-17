# Система корпоративных совместных поездок

Веб-приложение для организации совместных поездок сотрудников предприятия на работу.

## Возможности

- **Водители** размещают информацию о поездках (автомобиль, маршрут, время, стоимость, количество мест)
- **Пассажиры** выбирают доступные поездки и бронируют места
- **Авторизация** по доменной учётной записи (NTLM/Kerberos)
- **Оффлайн-работа** в закрытом контуре без доступа к интернету

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                  Браузер                         │
│            (React SPA)                          │
└───────────────────┬─────────────────────────────┘
                    │ HTTP
┌───────────────────▼─────────────────────────────┐
│                 Nginx                            │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │  Статика (React) │  │  NTLM-авторизация   │  │
│  │  /dist/index.html│  │  (модуль LDAP/NTLM) │  │
│  └──────────────────┘  └─────────────────────┘  │
│                    │                             │
│         /api/* ────┤ proxy_pass                  │
└────────────────────┼─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│              Node.js (Express)                    │
│              Бэкенд API                           │
│              Порт 3001                            │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│              PostgreSQL                           │
│              База данных                          │
│              Порт 5432                            │
└──────────────────────────────────────────────────┘
```

---

## Инструкция по развёртыванию

### Шаг 1. Подготовка на машине с интернетом (Windows 10)

#### 1.1. Сборка фронтенда

```powershell
# В папке проекта (на Windows)
npm install
npm run build
```

Результат сборки будет в папке `dist/`.

#### 1.2. Установка зависимостей бэкенда

```powershell
cd backend
npm install
```

Это создаст папку `backend/node_modules/`.

#### 1.3. Скачивание Node.js для Linux

Скачайте LTS-версию Node.js для Linux x64:
- https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz

#### 1.4. Формирование пакета для переноса

Создайте архив со следующим содержимым:

```
carpool-deploy/
├── dist/                    # Результат npm run build (фронтенд)
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── node_modules/        # Зависимости бэкенда
├── database/
│   └── init.sql             # Скрипт создания БД
├── deploy/
│   ├── nginx.conf           # Конфигурация Nginx
│   └── install.sh           # Скрипт установки
├── node-v20.11.0-linux-x64.tar.xz  # Node.js для Astra Linux
└── README.md                # Эта инструкция
```

#### 1.5. Альтернатива: подготовка через Docker (если Docker доступен)

Если на сервере есть Docker, можно использовать контейнеризацию:

```dockerfile
# Dockerfile.backend
FROM node:20-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --production
COPY backend/server.js ./
EXPOSE 3001
CMD ["node", "server.js"]
```

---

### Шаг 2. Перенос на сервер Astra Linux 1.8

Скопируйте архив на сервер любым доступным способом:
- USB-накопитель
- Сетевая папка (SMB/CIFS)
- SCP/SFTP (если есть сетевой доступ между машинами)

```bash
# Пример копирования по сети
scp carpool-deploy.tar.gz user@astra-server:/tmp/
```

---

### Шаг 3. Установка на сервере

#### 3.1. Распаковка

```bash
cd /tmp
tar xzf carpool-deploy.tar.gz
cd carpool-deploy
```

#### 3.2. Установка Node.js (если не установлен)

```bash
# Распаковка Node.js
sudo tar xf node-v20.11.0-linux-x64.tar.xz -C /usr/local --strip-components=1

# Проверка
node --version   # Должно показать v20.11.0
npm --version
```

#### 3.3. Установка PostgreSQL (если не установлен)

```bash
# Astra Linux 1.8 — PostgreSQL обычно есть в репозитории
sudo apt install postgresql postgresql-contrib

# Запуск
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

#### 3.4. Запуск скрипта установки

```bash
chmod +x deploy/install.sh
sudo ./deploy/install.sh
```

Скрипт выполнит:
1. Копирование файлов в `/opt/carpool/`
2. Создание пользователя и БД в PostgreSQL
3. Инициализацию таблиц
4. Настройку Nginx
5. Создание systemd-сервиса для бэкенда
6. Запуск всех сервисов

#### 3.5. Ручная установка (если скрипт не подходит)

```bash
# 1. Создание директорий
sudo mkdir -p /opt/carpool/{frontend,backend,database}

# 2. Копирование фронтенда
sudo cp -r dist/* /opt/carpool/frontend/dist/

# 3. Копирование бэкенда
sudo cp -r backend/* /opt/carpool/backend/
sudo chown -R www-data:www-data /opt/carpool/backend

# 4. Настройка БД
sudo -u postgres psql -c "CREATE USER carpool_user WITH PASSWORD 'ваш_пароль';"
sudo -u postgres psql -c "CREATE DATABASE carpool OWNER carpool_user;"
sudo -u postgres psql -d carpool -f database/init.sql

# 5. Создание .env
sudo tee /opt/carpool/backend/.env << EOF
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=carpool
DB_USER=carpool_user
DB_PASSWORD=ваш_пароль
EOF

# 6. Настройка Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/carpool.conf
sudo ln -sf /etc/nginx/sites-available/carpool.conf /etc/nginx/sites-enabled/
# Отредактируйте server_name в конфиге!
sudo nginx -t
sudo systemctl reload nginx

# 7. Создание systemd-сервиса
sudo tee /etc/systemd/system/carpool-backend.service << EOF
[Unit]
Description=Carpool Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/carpool/backend
ExecStart=/usr/local/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now carpool-backend
```

---

### Шаг 4. Настройка доменной авторизации

#### Вариант A: NTLM через Squid (рекомендуется)

1. Установите Squid:
```bash
sudo apt install squid
```

2. Настройте NTLM-аутентификацию в Squid:
```
# /etc/squid/squid.conf
auth_param ntlm program /usr/lib/squid/ntlm_auth
auth_param ntlm children 10
auth_param basic program /usr/lib/squid/basic_ldap_auth -R -b "dc=company,dc=local" -D "cn=reader,ou=service,dc=company,dc=local" -w "password" -f "sAMAccountName=%s" ldap://dc01.company.local
```

3. В конфиге Nginx добавьте:
```nginx
location / {
    auth_request /auth-ntlm;
    # ... остальная конфигурация
}

location = /auth-ntlm {
    internal;
    proxy_pass http://127.0.0.1:3128;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Real-IP $remote_addr;
}
```

#### Вариант B: LDAP-авторизация через nginx-auth-ldap

```nginx
ldap_server ad_server {
    url ldap://dc01.company.local:389/DC=company,DC=local?sAMAccountName?sub?(objectClass=person);
    binddn "CN=ldap_reader,OU=Service,DC=company,DC=local";
    binddn_password "password";
    require valid_user;
}

server {
    auth_ldap "Введите доменные учётные данные";
    auth_ldap_servers ad_server;
    # ...
}
```

#### Вариант В: Kerberos (SPNEGO)

```bash
# Установка модуля
sudo apt install nginx-extras  # или собрать nginx с модулем spnego
```

```nginx
# В секции server:
auth_gss on;
auth_gss_realm COMPANY.LOCAL;
auth_gss_keytab /etc/nginx/HTTP.keytab;
auth_gss_service_name HTTP/carpool.company.local;
```

---

### Шаг 5. Проверка работоспособности

```bash
# Проверка бэкенда
curl http://localhost:3001/api/health
# Ожидается: {"status":"ok","database":"connected"}

# Проверка фронтенда
curl -I http://localhost/
# Ожидается: HTTP/1.1 200 OK

# Проверка из браузера
# Откройте http://carpool.company.local
```

---

## Обслуживание

### Логи

```bash
# Логи бэкенда
journalctl -u carpool-backend -f

# Логи Nginx
tail -f /var/log/nginx/carpool_access.log
tail -f /var/log/nginx/carpool_error.log
```

### Резервное копирование БД

```bash
# Создание бэкапа
sudo -u postgres pg_dump carpool > /backup/carpool_$(date +%Y%m%d).sql

# Восстановление
sudo -u postgres psql carpool < /backup/carpool_20240101.sql
```

### Очистка старых данных

Добавьте в crontab:
```bash
# Удаление поездок старше 30 дней (кроме активных)
0 2 * * * sudo -u postgres psql carpool -c "DELETE FROM trips WHERE date < CURRENT_DATE - INTERVAL '30 days' AND status != 'active';"
```

---

## Структура проекта

```
├── src/                          # Исходный код React-приложения
│   ├── App.tsx                   # Главный компонент
│   ├── api.ts                    # API-клиент (с fallback на localStorage)
│   ├── types.ts                  # TypeScript типы
│   ├── main.tsx                  # Точка входа
│   ├── index.css                 # Стили Tailwind
│   └── components/
│       ├── Header.tsx            # Шапка с навигацией
│       ├── LoginScreen.tsx       # Экран входа (демо)
│       ├── TripList.tsx          # Список доступных поездок
│       ├── CreateTripForm.tsx    # Форма создания поездки
│       ├── BookingForm.tsx       # Форма бронирования
│       ├── MyTrips.tsx           # Мои поездки (водитель)
│       └── MyBookings.tsx        # Мои бронирования (пассажир)
├── backend/                      # Node.js бэкенд
│   ├── server.js                 # Express API-сервер
│   ├── package.json              # Зависимости
│   └── .env.example              # Пример конфигурации
├── database/
│   └── init.sql                  # Скрипт создания БД
├── deploy/
│   ├── nginx.conf                # Конфигурация Nginx
│   └── install.sh                # Скрипт установки
└── README.md                     # Этот файл
```

---

## Безопасность

1. **Пароли БД** — используйте сложные пароли, храните `.env` с правами `600`
2. **HTTPS** — в продакшене настройте TLS (можно использовать самоподписанный сертификат)
3. **Файрвол** — откройте только порты 80/443, порт 3001 бэкенда не должен быть доступен извне
4. **Обновления** — регулярно обновляйте Node.js, Nginx, PostgreSQL

---

## Поддержка

При проблемах проверьте:
1. Работает ли PostgreSQL: `sudo systemctl status postgresql`
2. Работает ли бэкенд: `sudo systemctl status carpool-backend`
3. Доступна ли БД: `sudo -u postgres psql -d carpool -c "SELECT 1"`
4. Корректен ли конфиг Nginx: `sudo nginx -t`
5. Логи: `journalctl -u carpool-backend --since "1 hour ago"`
