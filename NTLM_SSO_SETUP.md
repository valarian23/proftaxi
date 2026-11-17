# Настройка сквозной доменной авторизации (NTLM SSO)

## Что было исправлено

### 1. Auth-сервер (`auth/auth-server.js`)
- ✅ Добавлен `express-ntlm` middleware для автоматической NTLM-аутентификации
- ✅ Исправлены заголовки `WWW-Authenticate` — убрана кириллица (вызывала `ERR_INVALID_CHAR`)
- ✅ Добавлена функция `getUserInfoFromAD()` для получения displayName/email из AD после NTLM-аутентификации
- ✅ NTLM теперь работает как полноценный SSO — браузер автоматически отправляет токен

### 2. Nginx (`deploy/nginx-ssl-auth.conf`)
- ✅ Добавлен `proxy_pass_header WWW-Authenticate` — чтобы NTLM challenge доходил до клиента
- ✅ Отключён `keepalive` для auth-upstream — NTLM требует stateful-соединения
- ✅ Добавлен `proxy_http_version 1.1` и `Connection: close` для корректной работы NTLM handshake

### 3. Frontend (`src/App.tsx`, `src/api.ts`)
- ✅ Добавлена функция `checkAuth()` для проверки NTLM-авторизации
- ✅ Приложение автоматически определяет доменную учётную запись
- ✅ Если NTLM не сработал — fallback на демо-режим

---

## Как это работает

```
┌─────────────┐
│   Браузер   │  Пользователь в домене Windows
│  (доменный  │  → браузер автоматически отправляет NTLM-токен
│   клиент)   │
└──────┬──────┘
       │ Authorization: NTLM <token>
       ▼
┌─────────────┐
│    Nginx    │  auth_request → auth-сервер
│  (reverse   │  Передаёт заголовок Authorization
│   proxy)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Auth-сервер │  express-ntlm middleware
│  (Node.js)  │  1. Принимает NTLM Type 1 → отправляет Type 2 (challenge)
│  порт 3002  │  2. Принимает NTLM Type 3 → извлекает username
│             │  3. Запрашивает AD для получения displayName, email
└──────┬──────┘
       │
       │ X-Remote-User, X-Remote-Display-Name
       ▼
┌─────────────┐
│   Nginx     │  auth_request_set $auth_user
│  (передача  │  proxy_set_header X-Remote-User $auth_user
│   заголовка)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Backend    │  Читает X-Remote-User
│  (Node.js)  │  Определяет пользователя
│  порт 3001  │
└─────────────┘
```

---

## Пошаговая настройка

### Шаг 1. Установить зависимости auth-сервера

```bash
cd auth
npm install
```

Это установит `express-ntlm` — библиотеку для NTLM-аутентификации.

### Шаг 2. Настроить `.env` для auth-сервера

Создайте файл `auth/.env`:

```env
# Порт auth-сервера
AUTH_PORT=3002

# LDAP/Active Directory
LDAP_URL=ldap://dc01.yourdomain.local
LDAP_BASE_DN=DC=yourdomain,DC=local

# Service account для поиска пользователей в AD
LDAP_BIND_DN=CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local
LDAP_BIND_PASSWORD=YourServiceAccountPassword

# Фильтр поиска пользователя
LDAP_USER_SEARCH=(&(objectClass=user)(sAMAccountName={{username}}))

# NetBIOS-имя домена (ВАЖНО для NTLM!)
DOMAIN=YOURDOMAIN
```

**Критично:** `DOMAIN` должен совпадать с NetBIOS-именем вашего домена (не FQDN!).  
Проверить: `echo %USERDOMAIN%` на любом доменном компьютере.

### Шаг 3. Настроить Nginx

Отредактируйте `deploy/nginx-ssl-auth.conf`:

1. Замените `server_name carpool.your-company.local` на ваш домен (`uniontrip.knaaz.ru`)
2. Укажите правильные пути к SSL-сертификатам
3. Скопируйте конфиг:

```bash
sudo cp deploy/nginx-ssl-auth.conf /etc/nginx/sites-available/uniontrip.conf
sudo ln -sf /etc/nginx/sites-available/uniontrip.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 4. Запустить auth-сервер

```bash
cd auth
node auth-server.js
```

Или через systemd (используя `deploy/carpool-auth.service`):

```bash
sudo cp deploy/carpool-auth.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable carpool-auth
sudo systemctl start carpool-auth
```

### Шаг 5. Запустить backend

```bash
cd backend
npm install
node server.js
```

### Шаг 6. Собрать и разместить frontend

```bash
npm install
npm run build
# Скопировать dist/ в /opt/carpool/frontend/dist (или куда указывает nginx root)
```

---

## Требования для работы NTLM SSO

### На стороне клиента (браузер):

1. **Компьютер должен быть в домене** (или в доверенном лесу)
2. **Сайт должен быть в зоне "Интранет"** в настройках IE/Edge:
   - Панель управления → Свойства браузера → Безопасность → Местная интрасеть → Сайты
   - Добавить `uniontrip.knaaz.ru`
   
   **Или** через GPO:
   ```
   User Configuration → Policies → Administrative Templates → 
   Windows Components → Internet Explorer → Internet Control Panel → 
   Security Page → Site to Zone Assignment List
   ```

3. **Браузер должен поддерживать NTLM:**
   - ✅ Internet Explorer / Edge — по умолчанию
   - ✅ Chrome — если сайт в зоне "Интранет"
   - ✅ Firefox — настроить `network.automatic-ntlm-auth.trusted-uris` в `about:config`

### На стороне сервера:

1. **Сетевая доступность:** сервер должен иметь доступ к контроллеру домена (порт 389 для LDAP)
2. **DNS:** сервер должен резолвить имя контроллера домена
3. **Service account:** учётная запись для LDAP-поиска должна быть активна и не заблокирована

---

## Проверка работы

### 1. Проверить auth-сервер

```bash
curl -v http://localhost:3002/health
# Должен вернуть: {"status":"ok","ldap":"connected",...}
```

### 2. Проверить NTLM handshake

```bash
# Первый запрос — должен вернуть 401 с NTLM challenge
curl -v http://localhost:3002/auth
# Ожидаемый заголовок: WWW-Authenticate: NTLM

# Второй запрос с NTLM Type 1 (пример)
curl -v -H "Authorization: NTLM TlRMTVNTUAABAAAAB4IIAAAAAAAAAAAAAAAAAAAAAAA=" http://localhost:3002/auth
# Должен вернуть 401 с NTLM Type 2 (challenge)
```

### 3. Проверить через браузер

1. Откройте `https://uniontrip.knaaz.ru` с доменного компьютера
2. Браузер должен **автоматически** авторизовать вас (без ввода логина/пароля)
3. В правом верхнем углу должно отобразиться ваше ФИО

### 4. Проверить логи

```bash
# Логи auth-сервера
pm2 logs carpool-auth
# или
journalctl -u carpool-auth -f

# Ожидаемые записи при успешной авторизации:
# [AUTH] NTLM authenticated: YOURDOMAIN\ivanov
```

---

## Если NTLM не работает

### Проблема: Браузер не отправляет NTLM-токен

**Решение:**
1. Добавьте сайт в зону "Интранет" (см. выше)
2. Для Firefox: `about:config` → `network.automatic-ntlm-auth.trusted-uris` → добавьте URL сайта
3. Очистите кэш браузера и попробуйте снова

### Проблема: NTLM handshake не завершается

**Проверьте:**
1. В логах auth-сервера — приходят ли NTLM Type 1 и Type 3 сообщения
2. Правильно ли указан `DOMAIN` в `.env` (NetBIOS-имя, не FQDN!)
3. Доступен ли контроллер домена: `nc -zv dc01.yourdomain.local 389`

### Проблема: Пользователь авторизован, но ФИО не отображается

**Проверьте:**
1. Service account имеет права чтения атрибутов AD (displayName, mail)
2. В логах auth-сервера нет ошибок LDAP-поиска
3. Атрибут `displayName` заполнен в AD для вашего пользователя

### Проблема: Ошибка ERR_INVALID_CHAR в логах

**Решение:** Убедитесь, что в коде нет кириллицы в заголовках HTTP. Все значения `WWW-Authenticate` должны быть на английском.

---

## Fallback: Basic Auth

Если NTLM не работает (например, для внешних пользователей), система автоматически предлагает Basic Auth:

1. Браузер показывает стандартный диалог ввода логина/пароля
2. Пользователь вводит доменные учётные данные (`DOMAIN\username` / `username@domain.local`)
3. Auth-сервер проверяет через LDAP bind

---

## Структура проекта

```
├── auth/
│   ├── auth-server.js      # Auth-сервер (NTLM + LDAP)
│   ├── package.json         # Зависимости (express, ldapjs, express-ntlm)
│   └── .env                 # Конфигурация LDAP
├── backend/
│   ├── server.js            # API-сервер (Express + PostgreSQL)
│   └── package.json
├── deploy/
│   ├── nginx-ssl-auth.conf  # Nginx конфиг с auth_request
│   ├── carpool-auth.service # Systemd unit для auth-сервера
│   └── install-auth.sh      # Скрипт установки
├── src/                     # Frontend (React)
│   ├── App.tsx              # Главный компонент с проверкой авторизации
│   ├── api.ts               # API-клиент (checkAuth, getCurrentUser)
│   └── components/
└── dist/                    # Собранный frontend
```

---

## Краткий чек-лист

- [ ] Установлены зависимости: `cd auth && npm install`
- [ ] Создан `auth/.env` с правильными LDAP-параметрами
- [ ] `DOMAIN` в `.env` — NetBIOS-имя домена (не FQDN!)
- [ ] Nginx конфиг обновлён и перезапущен
- [ ] Auth-сервер запущен и доступен на порту 3002
- [ ] Backend запущен на порту 3001
- [ ] Frontend собран и размещён
- [ ] Сайт добавлен в зону "Интранет" на клиентских компьютерах
- [ ] Проверена авторизация через браузер с доменного компьютера

---

**Дата обновления:** 2026-01-XX  
**Сервер:** uniontrip.knaaz.ru
