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
const ntlm = require('express-ntlm');
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
// NTLM middleware для сквозной доменной авторизации (SSO)
// ============================================================

/**
 * express-ntlm middleware.
 * Автоматически обрабатывает NTLM-рукопожатие:
 *   1. Клиент → NTLM Type 1 (Negotiate)
 *   2. Сервер → NTLM Type 2 (Challenge)
 *   3. Клиент → NTLM Type 3 (Authenticate)
 * 
 * После успешного рукопожатия в req.ntlm появляются данные пользователя:
 *   req.ntlm.DomainName, req.ntlm.UserName, req.ntlm.Workstation
 * 
 * Настройки:
 *   - domain: NetBIOS-имя домена (должно совпадать с AD)
 *   - domaincontroller: адрес DC для валидации (опционально, для проверки пароля)
 */
const ntlmMiddleware = ntlm({
  domain: LDAP_CONFIG.domain,
  domaincontroller: null, // null = не проверять пароль через DC (доверяем NTLM-токену)
});

/**
 * Получить информацию о пользователе из AD по имени (sAMAccountName)
 * Используется после NTLM-аутентификации для получения displayName, email и т.д.
 */
async function getUserInfoFromAD(username) {
  if (!LDAP_CONFIG.bindDN || !LDAP_CONFIG.bindPassword) {
    // Нет service account — возвращаем только username
    return {
      username: username.toLowerCase(),
      displayName: username,
      email: `${username}@${LDAP_CONFIG.domain.toLowerCase()}.local`,
    };
  }

  return new Promise((resolve) => {
    const client = createLdapClient();
    
    client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword, (err) => {
      if (err) {
        console.error('[AD] Service bind failed:', err.message);
        client.unbind();
        return resolve({
          username: username.toLowerCase(),
          displayName: username,
          email: `${username}@${LDAP_CONFIG.domain.toLowerCase()}.local`,
        });
      }

      const searchFilter = LDAP_CONFIG.userSearchFilter.replace('{{username}}', username);
      const opts = {
        filter: searchFilter,
        scope: 'sub',
        attributes: [...LDAP_CONFIG.userAttributes, 'mail', 'userPrincipalName'],
      };

      client.search(LDAP_CONFIG.baseDN, opts, (err, res) => {
        if (err) {
          console.error('[AD] Search failed:', err.message);
          client.unbind();
          return resolve({
            username: username.toLowerCase(),
            displayName: username,
            email: `${username}@${LDAP_CONFIG.domain.toLowerCase()}.local`,
          });
        }

        let userEntry = null;
        res.on('searchEntry', (entry) => {
          userEntry = entry;
        });

        res.on('error', () => {
          client.unbind();
        });

        res.on('end', () => {
          client.unbind();
          
          if (!userEntry) {
            return resolve({
              username: username.toLowerCase(),
              displayName: username,
              email: `${username}@${LDAP_CONFIG.domain.toLowerCase()}.local`,
            });
          }

          const attrs = userEntry.attributes || {};
          const getVal = (name) => {
            const attr = attrs[name];
            if (!attr) return '';
            const vals = attr.values || attr.vals || [];
            return Array.isArray(vals) ? vals[0] || '' : String(vals);
          };

          resolve({
            username: username.toLowerCase(),
            displayName: getVal('displayName') || getVal('cn') || username,
            email: getVal('mail') || getVal('userPrincipalName') || `${username}@${LDAP_CONFIG.domain.toLowerCase()}.local`,
            dn: userEntry.objectName?.toString() || '',
          });
        });
      });
    });
  });
}

// ============================================================
// Маршруты
// ============================================================

/**
 * GET /auth — проверка авторизации (для Nginx auth_request)
 * 
 * Поддерживает два метода:
 *   1. NTLM — сквозная доменная авторизация (SSO)
 *      Браузер автоматически отправляет NTLM-токен, если компьютер в домене
 *   2. Basic Auth — fallback для не-доменных клиентов
 * 
 * Nginx делает подзапрос сюда. Если пользователь авторизован — 200.
 * Если нет — 401 с WWW-Authenticate для запроса учётных данных.
 */
app.get('/auth', ntlmMiddleware, async (req, res) => {
  // === Проверяем NTLM ===
  if (req.ntlm && req.ntlm.UserName) {
    const username = req.ntlm.UserName.toLowerCase();
    console.log(`[AUTH] NTLM authenticated: ${req.ntlm.DomainName}\\${req.ntlm.UserName}`);
    
    try {
      // Получаем полную информацию о пользователе из AD
      const userInfo = await getUserInfoFromAD(username);
      
      res.set('X-Remote-User', userInfo.username);
      res.set('X-Remote-Display-Name', userInfo.displayName);
      res.set('X-Remote-Email', userInfo.email);
      res.set('X-Auth-Method', 'ntlm');
      return res.status(200).send('OK');
    } catch (err) {
      console.error('[AUTH] Error getting user info:', err.message);
      // Даже если не получили информацию из AD — NTLM-аутентификация прошла
      res.set('X-Remote-User', username);
      res.set('X-Remote-Display-Name', username);
      res.set('X-Auth-Method', 'ntlm');
      return res.status(200).send('OK');
    }
  }

  // === Проверяем Negotiate (Kerberos/SPNEGO) ===
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Negotiate ')) {
    // Kerberos/SPNEGO — для полноценной реализации нужен пакет 'kerberos'
    // Пока возвращаем 401, чтобы браузер переключился на NTLM или Basic
    console.log('[AUTH] Negotiate header received, but Kerberos not configured');
  }

  // === Проверяем Basic Auth ===
  const auth = parseAuthorization(req);
  
  if (auth.method === 'basic') {
    try {
      const user = await ldapAuthenticate(auth.username, auth.password);
      if (user) {
        res.set('X-Remote-User', user.username);
        res.set('X-Remote-Display-Name', user.displayName);
        res.set('X-Auth-Method', 'basic');
        return res.status(200).send('OK');
      }
    } catch (err) {
      console.error('[AUTH] LDAP error:', err.message);
      return res.status(500).send('Authentication service error');
    }
  }

  // === Нет авторизации — запрашиваем NTLM + Basic ===
  // Важно: только ASCII-символы в заголовках!
  // NTLM должен идти первым — браузер в домене Windows автоматически ответит NTLM-токеном
  res.setHeader('WWW-Authenticate', 'NTLM');
  res.status(401).send('Authentication required');
});

/**
 * POST /auth — альтернативный эндпоинт для проверки (если нужно)
 */
app.post('/auth', ntlmMiddleware, async (req, res) => {
  // Аналогично GET /auth — поддерживаем NTLM
  if (req.ntlm && req.ntlm.UserName) {
    const username = req.ntlm.UserName.toLowerCase();
    try {
      const userInfo = await getUserInfoFromAD(username);
      return res.json({
        id: userInfo.username,
        username: userInfo.username,
        displayName: userInfo.displayName,
        email: userInfo.email,
        authMethod: 'ntlm',
      });
    } catch (err) {
      return res.json({
        id: username,
        username: username,
        displayName: username,
        authMethod: 'ntlm',
      });
    }
  }
  
  // Fallback — redirect на GET
  res.redirect(307, '/auth');
});

/**
 * GET /auth/me — информация о текущем пользователе
 * Используется фронтендом для получения данных пользователя
 */
app.get('/auth/me', ntlmMiddleware, async (req, res) => {
  // === NTLM-пользователь ===
  if (req.ntlm && req.ntlm.UserName) {
    const username = req.ntlm.UserName.toLowerCase();
    try {
      const userInfo = await getUserInfoFromAD(username);
      return res.json({
        id: userInfo.username,
        username: userInfo.username,
        displayName: userInfo.displayName,
        email: userInfo.email,
        role: 'both',
        authMethod: 'ntlm',
      });
    } catch (err) {
      return res.json({
        id: username,
        username: username,
        displayName: username,
        role: 'both',
        authMethod: 'ntlm',
      });
    }
  }

  // === Basic Auth ===
  const auth = parseAuthorization(req);
  
  if (auth.method === 'basic') {
    try {
      const user = await ldapAuthenticate(auth.username, auth.password);
      if (user) {
        return res.json({
          id: user.username,
          username: user.username,
          displayName: user.displayName,
          role: 'both',
          authMethod: 'basic',
        });
      }
    } catch (err) {
      console.error('[AUTH] LDAP error:', err.message);
      return res.status(500).json({ error: 'Authentication service error' });
    }
  }

  // Нет авторизации — запрашиваем NTLM (браузер в домене ответит автоматически)
  res.setHeader('WWW-Authenticate', 'NTLM');
  return res.status(401).json({ error: 'Authentication required' });
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
