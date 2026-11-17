# Настройка доменной авторизации (LDAP/Active Directory)

## Проблема

Squid — это HTTP-прокси, а не auth-сервер. Nginx `auth_request` ожидает простой ответ 200/401, а Squid возвращает 400.

## Решение

Создать отдельный **auth-сервис** на Node.js, который:
- Принимает запросы от Nginx через `auth_request`
- Проверяет учётные данные через LDAP/Active Directory
- Возвращает 200 (OK) или 401 (Unauthorized)

## Архитектура

```
Browser → Nginx (auth_request) → Auth Service (Node.js) → LDAP/AD
                    ↓
              Бэкенд (Node.js)
```

---

## Шаг 1. Установка зависимостей на машине с интернетом

На Windows-машине:

```powershell
cd auth
npm install
```

Это создаст папку `auth/node_modules/`.

---

## Шаг 2. Перенос на сервер

Добавьте папку `auth/` в пакет для переноса:

```
carpool-deploy/
├── auth/
│   ├── auth-server.js
│   ├── package.json
│   ├── .env.example
│   └── node_modules/        # ← Скопируйте с Windows
├── deploy/
│   ├── nginx-ssl-auth.conf  # ← Новый конфиг Nginx
│   └── carpool-auth.service # ← Systemd-сервис
└── ...
```

---

## Шаг 3. Установка на сервере

### 3.1. Копирование файлов

```bash
sudo cp -r auth /opt/carpool/auth
sudo chown -R www-data:www-data /opt/carpool/auth
```

### 3.2. Создание .env файла

```bash
sudo cp /opt/carpool/auth/.env.example /opt/carpool/auth/.env
sudo nano /opt/carpool/auth/.env
```

Заполните параметры:

```env
AUTH_PORT=3002

# URL контроллера домена
LDAP_URL=ldap://dc01.company.local:389

# Base DN для поиска
LDAP_BASE_DN=DC=company,DC=local

# Service account (опционально)
LDAP_BIND_DN=CN=ldap_reader,OU=Service,DC=company,DC=local
LDAP_BIND_PASSWORD=your_password

# Домен
DOMAIN=COMPANY
```

**Важно:** 
- Укажите реальный адрес контроллера домена
- Если есть service account — укажите его (лучше для поиска)
- Если нет — auth-сервис будет делать bind от имени пользователя

### 3.3. Установка прав

```bash
sudo chmod 600 /opt/carpool/auth/.env
sudo chown www-data:www-data /opt/carpool/auth/.env
```

### 3.4. Создание systemd-сервиса

```bash
sudo cp deploy/carpool-auth.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable carpool-auth
sudo systemctl start carpool-auth
```

### 3.5. Проверка auth-сервиса

```bash
# Статус
sudo systemctl status carpool-auth

# Проверка работоспособности
curl http://localhost:3002/health
# Ожидается: {"status":"ok","ldap":"connected",...}

# Проверка авторизации (замените username:password на доменные учётные данные)
curl -u DOMAIN\\username:password http://localhost:3002/auth/me
# Ожидается: {"id":"username","username":"username","displayName":"Иванов Иван",...}
```

---

## Шаг 4. Обновление конфигурации Nginx

### 4.1. Замена конфига

```bash
# Бэкап текущего конфига
sudo cp /etc/nginx/sites-available/carpool.conf /etc/nginx/sites-available/carpool.conf.bak

# Копирование нового конфига
sudo cp deploy/nginx-ssl-auth.conf /etc/nginx/sites-available/carpool.conf
```

### 4.2. Редактирование конфига

Откройте конфиг и замените:

```bash
sudo nano /etc/nginx/sites-available/carpool.conf
```

**Что нужно изменить:**

1. **server_name** — укажите ваш хост:
   ```nginx
   server_name carpool.company.local;
   ```

2. **SSL-сертификаты** — проверьте пути:
   ```nginx
   ssl_certificate     /etc/ssl/certs/carpool.crt;
   ssl_certificate_key /etc/ssl/private/carpool.key;
   ```

3. **Upstream** — проверьте порты:
   ```nginx
   upstream carpool_backend {
       server 127.0.0.1:5123;  # Ваш бэкенд
   }
   
   upstream carpool_auth {
       server 127.0.0.1:3002;  # Auth-сервис
   }
   ```

### 4.3. Проверка и перезагрузка

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Шаг 5. Проверка работы

### 5.1. Тест авторизации через Nginx

```bash
# Без авторизации — должен вернуть 401
curl -kI https://localhost/
# Ожидается: HTTP/2 401

# С авторизацией
curl -kI -u DOMAIN\\username:password https://localhost/
# Ожидается: HTTP/2 200
```

### 5.2. Проверка в браузере

1. Откройте `https://carpool.company.local`
2. Браузер запросит логин и пароль
3. Введите доменные учётные данные (формат: `DOMAIN\username` или просто `username`)
4. Сайт должен загрузиться

---

## Шаг 6. Настройка LDAP-параметров (если не работает)

### 6.1. Проверка подключения к LDAP

```bash
# Установите ldap-utils (если есть)
sudo apt install ldap-utils

# Проверка подключения
ldapsearch -x -H ldap://dc01.company.local -b "DC=company,DC=local" -D "CN=reader,OU=Service,DC=company,DC=local" -W "(sAMAccountName=username)"
```

### 6.2. Проверка service account

Если используете service account:

```bash
# Проверка bind от service account
ldapsearch -x -H ldap://dc01.company.local -b "DC=company,DC=local" -D "CN=reader,OU=Service,DC=company,DC=local" -W "(objectClass=user)"
```

### 6.3. Проверка формата DN

AD может использовать разные форматы:
- `CN=Иванов Иван,OU=Users,DC=company,DC=local`
- `CN=ivanov.ii,OU=Users,DC=company,DC=local`

Убедитесь, что `LDAP_USER_SEARCH` корректен:

```env
# Для поиска по sAMAccountName (логин)
LDAP_USER_SEARCH=(&(objectClass=user)(sAMAccountName={{username}}))

# Для поиска по CN (ФИО)
LDAP_USER_SEARCH=(&(objectClass=user)(cn={{username}}))
```

### 6.4. Проверка логов auth-сервиса

```bash
sudo journalctl -u carpool-auth -f
```

---

## Шаг 7. Альтернативные варианты авторизации

### Вариант A: Без service account (bind от имени пользователя)

Если нет service account, auth-сервис будет делать bind от имени самого пользователя:

```env
LDAP_BIND_DN=
LDAP_BIND_PASSWORD=
```

В этом случае auth-сервис формирует DN пользователя и делает bind напрямую.

### Вариант B: Упрощённая авторизация (только bind, без поиска)

Если нужно только проверить пароль без поиска пользователя:

Измените в `auth-server.js`:

```javascript
// Замените ldapAuthenticate на ldapSimpleBind
app.get('/auth/me', (req, res) => {
  const auth = parseAuthorization(req);
  
  ldapSimpleBind(auth.username, auth.password)
    .then(user => {
      if (user) {
        res.json(user);
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
});
```

### Вариант C: Автоматическая авторизация (NTLM/Kerberos)

Для автоматической авторизации в домене Windows:

1. **Kerberos** (рекомендуется):
   - Получите keytab: `ktpass -princ HTTP/carpool.company.local@COMPANY.LOCAL -mapuser carpool_http -pass *** -crypto AES256-SHA1 -ptype KRB5_NT_PRINCIPAL -out carpool.keytab`
   - Используйте модуль Nginx `nginx-http-auth-spnego`

2. **NTLM через winbind**:
   - Установите Samba/winbind
   - Настройте NTLM-аутентификацию в auth-сервисе

---

## Шаг 8. Отладка

### Проблема: 401 даже с правильными учётными данными

**Решение:**

1. Проверьте логи auth-сервиса:
   ```bash
   sudo journalctl -u carpool-auth -n 50
   ```

2. Проверьте подключение к LDAP:
   ```bash
   curl http://localhost:3002/health
   ```

3. Проверьте формат учётных данных:
   - Попробуйте `DOMAIN\username`
   - Попробуйте `username@domain.local`
   - Попробуйте просто `username`

### Проблема: LDAP connection error

**Решение:**

1. Проверьте доступность контроллера домена:
   ```bash
   ping dc01.company.local
   telnet dc01.company.local 389
   ```

2. Проверьте firewall:
   ```bash
   sudo ufw allow out to dc01.company.local port 389
   ```

3. Проверьте сертификат (для LDAPS):
   ```bash
   openssl s_client -connect dc01.company.local:636
   ```

### Проблема: Пользователь не найден

**Решение:**

1. Проверьте Base DN:
   ```bash
   ldapsearch -x -H ldap://dc01.company.local -b "DC=company,DC=local" -D "CN=reader,OU=Service,DC=company,DC=local" -W "(sAMAccountName=username)"
   ```

2. Проверьте фильтр поиска:
   ```env
   # Попробуйте разные варианты:
   LDAP_USER_SEARCH=(&(objectClass=person)(sAMAccountName={{username}}))
   LDAP_USER_SEARCH=(&(objectCategory=person)(sAMAccountName={{username}}))
   ```

---

## Шаг 9. Финальная проверка

```bash
# Все сервисы запущены?
sudo systemctl status carpool-backend carpool-auth nginx

# Auth-сервис работает?
curl http://localhost:3002/health

# Бэкенд работает?
curl http://localhost:5123/api/health

# Nginx работает?
curl -kI https://localhost/

# Авторизация работает?
curl -k -u DOMAIN\\username:password https://localhost/api/auth/me
```

---

## Полезные команды

```bash
# Логи auth-сервиса
sudo journalctl -u carpool-auth -f

# Перезапуск auth-сервиса
sudo systemctl restart carpool-auth

# Проверка LDAP-подключения
curl http://localhost:3002/health

# Тест авторизации
curl -u username:password http://localhost:3002/auth/me

# Проверка Nginx конфига
sudo nginx -t

# Перезагрузка Nginx
sudo systemctl reload nginx
```

---

## Безопасность

1. **Пароли**: Храните `.env` с правами `600`
2. **LDAP**: Используйте LDAPS (порт 636) в продакшене
3. **Service account**: Используйте учётную запись с минимальными правами
4. **Firewall**: Закройте порт 3002 от внешнего доступа

---

## Поддержка

Если возникли проблемы:

1. Проверьте логи: `sudo journalctl -u carpool-auth -n 100`
2. Проверьте LDAP: `curl http://localhost:3002/health`
3. Проверьте Nginx: `sudo tail -20 /var/log/nginx/carpool_error.log`
4. Проверьте конфиг: `sudo nginx -t`
