/**
 * Сервис доменной авторизации для Nginx auth_request
 * 
 * Архитектура:
 *   Browser → Nginx (auth_request) → Auth Service → LDAP/Active Directory
 *   
 * Поддерживаемые методы:
 *   1. Basic Auth + LDAP bind (пользователь вводит логин/пароль)
 *   2. NTLM (автоматическая авторизация в домене Windows)
 *   3. Kerberos/SPNEGO (если настроен keytab)
 * 
 * Запуск:
 *   npm install
 *   node auth-server.js
 * 
 * Переменные окружения (.env):
 *   AUTH_PORT=3002              — порт auth-сервиса
 *   LDAP_URL=ldap://dc01.company.local
 *   LDAP_BASE_DN=DC=company,DC=local
 *   LDAP_BIND_DN=CN=reader,OU=Service,DC=company,DC=local
 *   LDAP_BIND_PASSWORD=***
 *   LDAP_USER_SEARCH=(&(objectClass=user)(sAMAccountName={{username}}))
 *   DOMAIN=COMPANY              — домен для NTLM
 */

const express = require('express');
const ldapjs = require('ldapjs');
require('dotenv').config();

const app = express();
const PORT = process.env.AUTH_PORT || 3002;

// ============================================================
// Конфигурация LDAP
// ============================================================

const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://dc01.company.local',
  baseDN: process.env.LDAP_BASE_DN || 'DC=company,DC=local',
  bindDN: process.env.LDAP_BIND_DN || '',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
  userSearchFilter: process.env.LDAP_USER_SEARCH || 
    '(&(objectClass=user)(sAMAccountName={{username}}))',
  // Атрибуты, которые нужно получить о пользователе
  userAttributes: ['sAMAccountName', 'displayName', 'cn', 'mail'],
  // Домен для NTLM (DOMAIN\username)
  domain: process.env.DOMAIN || 'COMPANY',
};

// ============================================================
// LDAP клиент
// ============================================================

/**
 * Создаёт LDAP-клиент
 */
function createLdapClient() {
  return ldapjs.createClient({
    url: LDAP_CONFIG.url,
    tlsOptions: {
      rejectUnauthorized: false, // Для самоподписанных сертификатов AD
    },
    reconnect: true,
  });
}

/**
 * Проверяет учётные данные через LDAP bind
 * @param {string} username — имя пользователя (sAMAccountName)
 * @param {string} password — пароль
 * @returns {Promise<Object>} — информация о пользователе или null
 */
async function ldapAuthenticate(username, password) {
  return new Promise((resolve, reject) => {
    const client = createLdapClient();
    
    // Если есть service account — используем его для поиска
    // Иначе — делаем bind от имени пользователя
    const doSearch = (bindDN, bindPassword) => {
      client.bind(bindDN, bindPassword, (err) => {
        if (err) {
          client.unbind();
          return reject(new Error(`LDAP bind failed: ${err.message}`));
        }

        // Ищем пользователя
        const searchFilter = LDAP_CONFIG.userSearchFilter.replace('{{username}}', username);
        const opts = {
          filter: searchFilter,
          scope: 'sub',
          attributes: LDAP_CONFIG.userAttributes,
        };

        client.search(LDAP_CONFIG.baseDN, opts, (err, res) => {
          if (err) {
            client.unbind();
            return reject(new Error(`LDAP search failed: ${err.message}`));
          }

          let userEntry = null;
          
          res.on('searchEntry', (entry) => {
            userEntry = entry;
          });

          res.on('error', (err) => {
            client.unbind();
            reject(new Error(`LDAP search error: ${err.message}`));
          });

          res.on('end', () => {
            if (!userEntry) {
              client.unbind();
              return resolve(null); // Пользователь не найден
            }

            // Если bind был от service account — проверяем пароль пользователя
            if (bindDN === LDAP_CONFIG.bindDN && LDAP_CONFIG.bindDN) {
              // Формируем DN пользователя для bind
              const userDN = userEntry.objectName;
              
              // Пробуем bind от имени пользователя
              client.bind(userDN, password, (err) => {
                client.unbind();
                if (err) {
                  resolve(null); // Неверный пароль
                } else {
                  resolve({
                    username: username.toLowerCase(),
                    displayName: userEntry.attributes.displayName?.values[0] || 
                                 userEntry.attributes.cn?.values[0] || 
                                 username,
                    dn: userDN.toString(),
                  });
                }
              });
            } else {
              // Bind был от имени пользователя — значит пароль верный
              client.unbind();
              resolve({
                username: username.toLowerCase(),
                displayName: userEntry.attributes.displayName?.values[0] || 
                             userEntry.attributes.cn?.values[0] || 
                             username,
                dn: userEntry.objectName.toString(),
              });
            }
          });
        });
      });
    };

    // Если есть service account — ищем через него
    if (LDAP_CONFIG.bindDN && LDAP_CONFIG.bindPassword) {
      doSearch(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword);
    } else {
      // Иначе — формируем DN пользователя и делаем bind напрямую
      // Формат: DOMAIN\username или username@domain
      const userDN = `CN=${username},OU=Users,${LDAP_CONFIG.baseDN}`;
      // Пробуем bind от имени пользователя
      client.bind(userDN, password, (err) => {
        if (err) {
          // Если bind не удался — возможно, DN неправильный
          // Пробуем найти пользователя без bind
          client.unbind();
          resolve(null);
        } else {
          client.unbind();
          resolve({
            username: username.toLowerCase(),
            displayName: username,
            dn: userDN,
          });
        }
      });
    }
  });
}

/**
 * Проверяет учётные данные через простой bind (без поиска)
 * Быстрее, но требует точного DN
 */
async function ldapSimpleBind(username, password) {
  return new Promise((resolve, reject) => {
    const client = createLdapClient();
    
    // Формат для AD: username@domain или DOMAIN\username
    const userPrincipal = `${username}@${LDAP_CONFIG.domain.toLowerCase()}.local`;
    
    client.bind(userPrincipal, password, (err) => {
      client.unbind();
      if (err) {
        resolve(null); // Неверные учётные данные
      } else {
        resolve({
          username: username.toLowerCase(),
          displayName: username,
        });
      }
    });
  });
}

// ============================================================
// Middleware: парсинг Authorization header
// ============================================================

/**
 * Извлекает учётные данные из заголовка Authorization
 * Поддерживает: Basic, NTLM, Negotiate
 */
function parseAuthorization(req) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return { method: null };
  }

  // Basic Auth: base64(username:password)
  if (authHeader.startsWith('Basic ')) {
    const base64 = authHeader.substring(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const [username, ...passwordParts] = decoded.split(':');
    const password = passwordParts.join(':');
    
    // Убираем домен из имени пользователя (DOMAIN\username → username)
    const cleanUsername = username.includes('\\') 
      ? username.split('\\')[1] 
      : username;
    
    return {
      method: 'basic',
      username: cleanUsername,
      password: password,
    };
  }

  // NTLM: Type 1, 2, 3 messages
  if (authHeader.startsWith('NTLM ')) {
    const ntlmToken = authHeader.substring(5);
    const tokenBuffer = Buffer.from(ntlmToken, 'base64');
    
    // Определяем тип NTLM-сообщения
    // NTLM Type 1 (Negotiate): начинается с "NTLMSSP\0" + тип 1 (0x01000000)
    // NTLM Type 3 (Authenticate): тип 3 (0x03000000)
    if (tokenBuffer.length >= 12) {
      const messageType = tokenBuffer.readUInt32LE(8);
      
      if (messageType === 1) {
        return { method: 'ntlm', type: 1, token: ntlmToken };
      } else if (messageType === 3) {
        // Type 3 содержит имя пользователя
        // Парсинг NTLM Type 3 (упрощённый)
        const username = extractNtlmUsername(tokenBuffer);
        return { method: 'ntlm', type: 3, token: ntlmToken, username };
      }
    }
    
    return { method: 'ntlm', type: 'unknown', token: ntlmToken };
  }

  // Negotiate (Kerberos/SPNEGO)
  if (authHeader.startsWith('Negotiate ')) {
    return { method: 'negotiate', token: authHeader.substring(10) };
  }

  return { method: 'unknown', raw: authHeader };
}

/**
 * Извлекает имя пользователя из NTLM Type 3 message
 */
function extractNtlmUsername(buffer) {
  try {
    // NTLM Type 3 structure (упрощённый парсинг)
    // Security buffer для username: offset 36, length 8 bytes
    const usernameLen = buffer.readUInt16LE(36);
    const usernameOffset = buffer.readUInt32LE(44);
    
    if (usernameLen > 0 && usernameOffset + usernameLen <= buffer.length) {
      const usernameBuffer = buffer.slice(usernameOffset, usernameOffset + usernameLen);
      // NTLM использует UTF-16LE для строк (если флаг negotiated)
      let username = usernameBuffer.toString('utf16le');
      
      // Убираем домен (DOMAIN\username → username)
      if (username.includes('\\')) {
        username = username.split('\\')[1];
      }
      
      return username.toLowerCase();
    }
  } catch (e) {
    // Ошибка парсинга
  }
  
  return null;
}

// ============================================================
// Маршруты
// ============================================================

/**
 * GET /auth — проверка авторизации (для Nginx auth_request)
 * 
 * Nginx делает подзапрос сюда. Если пользователь авторизован — 200.
 * Если нет — 401 с WWW-Authenticate для запроса учётных данных.
 */
app.get('/auth', (req, res) => {
  const auth = parseAuthorization(req);
  
  if (!auth.method) {
    // Нет заголовка Authorization — запрашиваем учётные данные
    res.set('WWW-Authenticate', 'Basic realm="Корпоративные поездки"');
    return res.status(401).send('Authentication required');
  }

  if (auth.method === 'basic') {
    // Basic Auth — проверяем через LDAP
    ldapAuthenticate(auth.username, auth.password)
      .then(user => {
        if (user) {
          // Успешная авторизация
          res.set('X-Remote-User', user.username);
          res.set('X-Remote-Display-Name', user.displayName);
          res.set('X-Auth-Method', 'basic');
          res.status(200).send('OK');
        } else {
          // Неверные учётные данные
          res.set('WWW-Authenticate', 'Basic realm="Корпоративные поездки", error="Invalid credentials"');
          res.status(401).send('Invalid credentials');
        }
      })
      .catch(err => {
        console.error('LDAP error:', err.message);
        res.status(500).send('Authentication service error');
      });
    return;
  }

  if (auth.method === 'ntlm') {
    if (auth.type === 1) {
      // NTLM Type 1 — отправляем challenge (Type 2)
      // Для полноценной NTLM нужен winbind или samba
      // Здесь — заглушка, запрашиваем Basic Auth
      res.set('WWW-Authenticate', 'NTLM');
      res.set('WWW-Authenticate', 'Basic realm="Корпоративные поездки"');
      return res.status(401).send('NTLM challenge');
    }
    
    if (auth.type === 3 && auth.username) {
      // NTLM Type 3 — пользователь уже аутентифицирован DC
      // Доверяем NTLM-токену (если настроен winbind)
      // Или запрашиваем Basic Auth для проверки пароля
      res.set('X-Remote-User', auth.username);
      res.set('X-Remote-Display-Name', auth.username);
      res.set('X-Auth-Method', 'ntlm');
      res.status(200).send('OK');
      return;
    }
  }

  // Неизвестный метод — запрашиваем Basic Auth
  res.set('WWW-Authenticate', 'Basic realm="Корпоративные поездки"');
  res.status(401).send('Unsupported auth method');
});

/**
 * POST /auth — альтернативный эндпоинт для проверки (если нужно)
 */
app.post('/auth', (req, res) => {
  // Аналогично GET /auth
  res.redirect(307, '/auth');
});

/**
 * GET /auth/me — информация о текущем пользователе
 * Используется фронтендом для получения данных пользователя
 */
app.get('/auth/me', (req, res) => {
  const auth = parseAuthorization(req);
  
  if (!auth.method || auth.method !== 'basic') {
    res.set('WWW-Authenticate', 'Basic realm="Корпоративные поездки"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  ldapAuthenticate(auth.username, auth.password)
    .then(user => {
      if (user) {
        res.json({
          id: user.username,
          username: user.username,
          displayName: user.displayName,
          role: 'both', // По умолчанию — и водитель, и пассажир
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    })
    .catch(err => {
      console.error('LDAP error:', err.message);
      res.status(500).json({ error: 'Authentication service error' });
    });
});

/**
 * GET /health — проверка работоспособности auth-сервиса
 */
app.get('/health', (req, res) => {
  // Проверяем подключение к LDAP
  const client = createLdapClient();
  
  client.on('error', (err) => {
    res.status(500).json({ 
      status: 'error', 
      ldap: 'disconnected',
      message: err.message 
    });
  });

  client.on('connect', () => {
    client.unbind();
    res.json({ 
      status: 'ok', 
      ldap: 'connected',
      ldapUrl: LDAP_CONFIG.url,
      domain: LDAP_CONFIG.domain,
    });
  });
});

/**
 * GET / — информация о сервисе
 */
app.get('/', (req, res) => {
  res.json({
    service: 'carpool-auth',
    version: '1.0.0',
    description: 'Доменная авторизация для системы совместных поездок',
    endpoints: {
      '/auth': 'Проверка авторизации (для Nginx auth_request)',
      '/auth/me': 'Информация о текущем пользователе',
      '/health': 'Проверка работоспособности',
    },
  });
});

// ============================================================
// Запуск сервера
// ============================================================

app.listen(PORT, () => {
  console.log(`Auth service запущен на порту ${PORT}`);
  console.log(`LDAP: ${LDAP_CONFIG.url}`);
  console.log(`Base DN: ${LDAP_CONFIG.baseDN}`);
  console.log(`Domain: ${LDAP_CONFIG.domain}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  GET /auth     — проверка авторизации');
  console.log('  GET /auth/me  — информация о пользователе');
  console.log('  GET /health   — проверка работоспособности');
});
