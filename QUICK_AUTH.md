# Быстрая настройка авторизации (шпаргалка)

## Проблема
Ошибка `auth request unexpected status '400'` — Squid не работает как auth-сервер для Nginx.

## Решение
Установить отдельный auth-сервис на Node.js, который проверяет учётные данные через LDAP/AD.

---

## Быстрый старт (5 шагов)

### 1. На Windows: установка зависимостей

```powershell
cd auth
npm install
```

### 2. Перенести на сервер

Добавьте папку `auth/` с `node_modules/` в пакет.

### 3. На сервере: установка

```bash
sudo bash deploy/install-auth.sh
```

Скрипт спросит параметры LDAP — укажите:
- `LDAP_URL` — адрес контроллера домена (например, `ldap://dc01.company.local:389`)
- `LDAP_BASE_DN` — базовый DN (например, `DC=company,DC=local`)
- `DOMAIN` — имя домена (например, `COMPANY`)

### 4. Обновить Nginx

```bash
sudo cp deploy/nginx-ssl-auth.conf /etc/nginx/sites-available/carpool.conf
sudo nano /etc/nginx/sites-available/carpool.conf
# Проверьте: server_name, SSL-пути, upstream порты
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Проверить

```bash
# Auth-сервис работает?
curl http://localhost:3002/health

# Авторизация работает?
curl -u DOMAIN\\username:password http://localhost:3002/auth/me

# Сайт открывается?
curl -kI https://localhost/
```

---

## Если не работает

### Auth-сервис не подключается к LDAP

```bash
# Проверьте доступность контроллера домена
ping dc01.company.local
telnet dc01.company.local 389

# Проверьте логи
sudo journalctl -u carpool-auth -n 50
```

### 401 с правильными учётными данными

```bash
# Проверьте формат логина
curl -u username:password http://localhost:3002/auth/me
curl -u DOMAIN\\username:password http://localhost:3002/auth/me
curl -u username@company.local:password http://localhost:3002/auth/me

# Проверьте параметры LDAP в .env
sudo cat /opt/carpool/auth/.env
```

### Nginx возвращает 500

```bash
# Проверьте конфиг
sudo nginx -t

# Проверьте, что auth-сервис запущен
sudo systemctl status carpool-auth

# Проверьте логи Nginx
sudo tail -20 /var/log/nginx/carpool_error.log
```

---

## Полезные команды

```bash
# Логи auth-сервиса
sudo journalctl -u carpool-auth -f

# Перезапуск auth-сервиса
sudo systemctl restart carpool-auth

# Проверка LDAP
curl http://localhost:3002/health

# Тест авторизации
curl -u username:password http://localhost:3002/auth/me

# Проверка Nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

## Полная документация

См. файл `AUTH_SETUP.md` — подробная инструкция по настройке LDAP/AD.
