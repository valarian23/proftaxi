import { useState } from 'react';

type Tab = 'diagnose' | 'checklist' | 'code' | 'commands';

function App() {
  const [tab, setTab] = useState<Tab>('diagnose');
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 text-xl">🔐</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Диагностика AD/LDAP авторизации</h1>
            <p className="text-sm text-slate-400">uniontrip.knaaz.ru — вход по доменной учётной записи</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Error Summary */}
        <div className="mb-8 p-5 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 text-2xl mt-0.5">⚠️</span>
            <div>
              <h2 className="text-amber-300 font-semibold text-lg mb-2">Не удаётся войти под доменной учётной записью</h2>
              <p className="text-slate-300 text-sm">
                Ниже — пошаговая диагностика: от проверки сетевого доступа до LDAP-запросов. 
                Пройдите все шаги сверху вниз — проблема обычно находится на одном из первых этапов.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-slate-800/50 rounded-lg p-1">
          {[
            { id: 'diagnose' as Tab, label: '🔍 Пошаговая диагностика' },
            { id: 'checklist' as Tab, label: '📋 Типичные ошибки' },
            { id: 'code' as Tab, label: '💻 Рабочий код' },
            { id: 'commands' as Tab, label: '⌨️ Команды' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-slate-700 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'diagnose' && (
          <DiagnoseSection expandedStep={expandedStep} setExpandedStep={setExpandedStep} />
        )}
        {tab === 'checklist' && <ChecklistSection />}
        {tab === 'code' && <CodeSection />}
        {tab === 'commands' && <CommandsSection />}
      </main>

      <footer className="border-t border-slate-700/50 mt-12 py-6 text-center text-slate-500 text-sm">
        Диагностика AD/LDAP для uniontrip.knaaz.ru • {new Date().toLocaleDateString('ru-RU')}
      </footer>
    </div>
  );
}

/* ============================ DIAGNOSE SECTION ============================ */
function DiagnoseSection({
  expandedStep,
  setExpandedStep,
}: {
  expandedStep: number | null;
  setExpandedStep: (n: number | null) => void;
}) {
  const steps = [
    {
      title: 'Шаг 1. Сеть: доступен ли контроллер домена?',
      color: 'blue',
      content: (
        <div className="space-y-3 text-slate-300 text-sm">
          <p>Сначала убедитесь, что сервер с Node.js <strong className="text-white">физически достигает</strong> контроллера домена (DC).</p>
          <CodeBlock>{`# Проверить DNS — резолвится ли имя DC?
nslookup dc.yourdomain.local
# или
dig dc.yourdomain.local

# Проверить доступность порта LDAP (389) или LDAPS (636)
nc -zv dc.yourdomain.local 389
nc -zv dc.yourdomain.local 636

# Или через telnet
telnet dc.yourdomain.local 389`}</CodeBlock>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="text-red-400 font-medium text-xs mb-1">❌ Если порт недоступен</div>
            <ul className="text-slate-400 space-y-1 list-disc list-inside">
              <li>Проверьте firewall на сервере и между сегментами сети</li>
              <li>Убедитесь, что сервер в правильном VLAN / подсети</li>
              <li>Проверьте, что DC не заблокировал IP сервера</li>
              <li>Если сервер в DMZ — нужен проброс портов или VPN</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: 'Шаг 2. Формат логина: что именно вводит пользователь?',
      color: 'purple',
      content: (
        <div className="space-y-3 text-slate-300 text-sm">
          <p>AD принимает логины в <strong className="text-white">разных форматах</strong>. Убедитесь, что ваш код обрабатывает нужный:</p>
          <div className="grid gap-2">
            <div className="bg-slate-900/50 rounded p-3">
              <code className="text-emerald-300">DOMAIN\username</code>
              <span className="text-slate-500 ml-2">— NetBIOS-формат</span>
            </div>
            <div className="bg-slate-900/50 rounded p-3">
              <code className="text-emerald-300">username@domain.local</code>
              <span className="text-slate-500 ml-2">— UPN (User Principal Name)</span>
            </div>
            <div className="bg-slate-900/50 rounded p-3">
              <code className="text-emerald-300">username</code>
              <span className="text-slate-500 ml-2">— только sAMAccountName (нужен Base DN)</span>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="text-amber-400 font-medium text-xs mb-1">💡 Совет</div>
            <p className="text-slate-400">
              Добавьте логирование <strong className="text-white">до</strong> LDAP-запроса, чтобы видеть, какой именно логин приходит от пользователя.
              Часто проблема в том, что пользователь вводит email, а код ожидает sAMAccountName.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Шаг 3. Bind DN: правильная ли сервисная учётка?',
      color: 'orange',
      content: (
        <div className="space-y-3 text-slate-300 text-sm">
          <p>Для поиска пользователей в AD нужна <strong className="text-white">сервисная учётка</strong> (service account) с правами чтения каталога.</p>
          <CodeBlock>{`// Правильный bind DN:
bindDN: 'CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local'
// или (upn-формат):
bindDN: 'svc_ldap@yourdomain.local'

// ❌ Частые ошибки:
bindDN: 'svc_ldap'                    // недостаточно — нужен полный DN
bindDN: 'CN=svc_ldap'                 // нет DC-компонентов
bindDN: 'svc_ldap@domain'             // домен без .local`}</CodeBlock>
          <p>Проверьте, что пароль сервисной учётки:</p>
          <ul className="list-disc list-inside text-slate-400 space-y-1">
            <li>Не истёк (политика паролей AD)</li>
            <li>Не заблокирован (учётка не locked out)</li>
            <li>Совпадает с тем, что в <code className="bg-slate-700 px-1 rounded text-amber-300">.env</code> (нет лишних пробелов, кавычек)</li>
          </ul>
        </div>
      ),
    },
    {
      title: 'Шаг 4. Base DN и Search Filter: находится ли пользователь?',
      color: 'cyan',
      content: (
        <div className="space-y-3 text-slate-300 text-sm">
          <p><strong className="text-white">Base DN</strong> — откуда начинать поиск. Если пользователь в другом OU — не найдётся.</p>
          <CodeBlock>{`// Правильно — корень домена (найдёт везде):
baseDN: 'DC=yourdomain,DC=local'

// Слишком узко — найдёт только в конкретной OU:
baseDN: 'OU=Users,OU=Office,DC=yourdomain,DC=local'

// Search filter — по какому атрибуту искать:
// ✅ sAMAccountName (короткое имя):
filter: '(sAMAccountName={{username}})'

// ✅ userPrincipalName (email-подобный):
filter: '(userPrincipalName={{username}})'

// ✅ Оба варианта:
filter: '(|(sAMAccountName={{username}})(userPrincipalName={{username}}))'`}</CodeBlock>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="text-blue-400 font-medium text-xs mb-1">🔬 Как узнать Base DN</div>
            <p className="text-slate-400">
              На контроллере домена выполните: <code className="bg-slate-700 px-1 rounded text-amber-300">dsquery user -name "ВашеИмя"</code> — 
              он покажет полный DN вашего пользователя. Base DN — это часть после первого OU.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Шаг 5. TLS/SSL: сертификат доверяем?',
      color: 'pink',
      content: (
        <div className="space-y-3 text-slate-300 text-sm">
          <p>Если используете <code className="bg-slate-700 px-1 rounded text-amber-300">ldaps://</code> (порт 636), Node.js проверяет сертификат DC.</p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="text-red-400 font-medium text-xs mb-1">❌ Частая ошибка</div>
            <pre className="text-red-200/80 text-xs overflow-x-auto">{`Error: unable to verify the first certificate
Error: self-signed certificate
Error: HOSTNAME_MISMATCH`}</pre>
          </div>
          <p>Решения (в порядке предпочтения):</p>
          <div className="space-y-2">
            <div className="bg-slate-900/50 rounded p-3">
              <div className="text-emerald-400 text-xs font-medium">Вариант 1 — Указать CA-сертификат домена</div>
              <CodeBlock>{`const ldap = new ldapjs.Client({
  url: 'ldaps://dc.yourdomain.local',
  tlsOptions: {
    ca: [fs.readFileSync('/path/to/domain-ca.crt')],
    rejectUnauthorized: true
  }
});`}</CodeBlock>
            </div>
            <div className="bg-slate-900/50 rounded p-3">
              <div className="text-amber-400 text-xs font-medium">Вариант 2 — Отключить проверку (только для тестирования!)</div>
              <CodeBlock>{`const ldap = new ldapjs.Client({
  url: 'ldaps://dc.yourdomain.local',
  tlsOptions: {
    rejectUnauthorized: false  // ⚠️ Не для продакшена
  }
});`}</CodeBlock>
            </div>
            <div className="bg-slate-900/50 rounded p-3">
              <div className="text-blue-400 text-xs font-medium">Вариант 3 — Использовать STARTTLS на порту 389</div>
              <CodeBlock>{`// ldap:// (не ldaps) + STARTTLS
const ldap = new ldapjs.Client({ url: 'ldap://dc.yourdomain.local' });
// Затем: client.startTLS({ tlsOptions: { rejectUnauthorized: false } });`}</CodeBlock>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Шаг 6. Проверка через ldapsearch / ldp.exe',
      color: 'green',
      content: (
        <div className="space-y-3 text-slate-300 text-sm">
          <p>Исключите Node.js из цепочки — проверьте LDAP напрямую:</p>
          <CodeBlock>{`# Linux (ldapsearch):
ldapsearch -x -H ldap://dc.yourdomain.local \\
  -D "CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local" \\
  -W \\
  -b "DC=yourdomain,DC=local" \\
  "(sAMAccountName=ваш_логин)"

# Windows (ldp.exe):
# 1. Запустите ldp.exe
# 2. Connection → Connect → dc.yourdomain.local:389
# 3. Connection → Bind → укажите сервисную учётку
# 4. Browse → Search → Base DN: DC=yourdomain,DC=local
#    Filter: (sAMAccountName=ваш_логин)
# 5. Нажмите Run`}</CodeBlock>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <div className="text-emerald-400 font-medium text-xs mb-1">✅ Если ldapsearch находит пользователя</div>
            <p className="text-slate-400">
              Значит проблема в коде Node.js — сравните параметры bindDN, baseDN и filter с теми, что работают в ldapsearch.
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="text-red-400 font-medium text-xs mb-1">❌ Если ldapsearch тоже не находит</div>
            <p className="text-slate-400">
              Проблема в AD / сети / учётке — не в коде. Смотрите шаги 1-3.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div
          key={i}
          className={`rounded-xl border transition-all ${
            expandedStep === i
              ? 'bg-slate-800/70 border-slate-600/50'
              : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50'
          }`}
        >
          <button
            onClick={() => setExpandedStep(expandedStep === i ? null : i)}
            className="w-full px-5 py-4 flex items-center gap-3 text-left"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                step.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                step.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                step.color === 'orange' ? 'bg-orange-500/20 text-orange-400' :
                step.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' :
                step.color === 'pink' ? 'bg-pink-500/20 text-pink-400' :
                step.color === 'green' ? 'bg-green-500/20 text-green-400' :
                'bg-slate-500/20 text-slate-400'
              }`}
            >
              {i + 1}
            </div>
            <span className="flex-1 text-white font-medium">{step.title}</span>
            <span className={`text-slate-400 transition-transform ${expandedStep === i ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          {expandedStep === i && (
            <div className="px-5 pb-5 border-t border-slate-700/30 pt-4">
              {step.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================ CHECKLIST SECTION ============================ */
function ChecklistSection() {
  const errors = [
    {
      symptom: 'LDAP ошибка: "Invalid Credentials" (код 49)',
      causes: [
        'Неверный пароль сервисной учётки (bindDN)',
        'Учётка заблокирована или пароль истёк',
        'Неправильный формат bindDN (нужен полный DN, не просто username)',
        'Лишние пробелы или символы в .env файле',
      ],
    },
    {
      symptom: 'Пользователь не найден (пустой результат поиска)',
      causes: [
        'Неправильный Base DN — пользователь в другой OU',
        'Неправильный Search Filter (sAMAccountName vs userPrincipalName)',
        'Пользователь вводит email, а фильтр ищет по sAMAccountName',
        'Сервисная учётка не имеет прав чтения нужной OU',
        'Учётка пользователя отключена в AD (userAccountControl = 514)',
      ],
    },
    {
      symptom: 'Connection refused / ETIMEDOUT',
      causes: [
        'Неверный адрес контроллера домена',
        'Firewall блокирует порт 389 (LDAP) или 636 (LDAPS)',
        'Сервер Node.js не в доменной сети / VLAN',
        'DC не отвечает (перезагрузка, проблема с AD DS)',
      ],
    },
    {
      symptom: 'TLS/SSL ошибки (certificate errors)',
      causes: [
        'Используется ldaps:// но не указан CA-сертификат',
        'Self-signed сертификат DC — Node.js его не принимает',
        'Hostname mismatch — сертификат выдан на другое имя',
        'Решение: указать tlsOptions.ca или rejectUnauthorized: false',
      ],
    },
    {
      symptom: 'Логин проходит, но сессия не создаётся',
      causes: [
        'Cookie не сохраняются (проблема с SameSite / Secure)',
        'JWT-секрет не совпадает между middleware',
        'Redis/session store недоступен',
        'nginx не проксирует Set-Cookie заголовок',
      ],
    },
    {
      symptom: 'Работает локально, но не на сервере',
      causes: [
        'На сервере другой .env (не те переменные окружения)',
        'Сервер в другой подсети — нет доступа к DC',
        'SELinux / AppArmor блокирует исходящие соединения',
        'Node.js версия отличается (ldapjs API может отличаться)',
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {errors.map((err, i) => (
        <div key={i} className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-red-400 text-lg">🐛</span>
            <h4 className="text-white font-semibold">{err.symptom}</h4>
          </div>
          <div className="ml-8">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Возможные причины:</div>
            <ul className="space-y-1.5">
              {err.causes.map((cause, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-slate-500 mt-1">•</span>
                  <span>{cause}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ CODE SECTION ============================ */
function CodeSection() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-2">📄 .env — переменные окружения</h3>
        <p className="text-slate-400 text-sm mb-3">Проверьте, что все значения корректны. Обратите внимание на отсутствие лишних пробелов и кавычек.</p>
        <CodeBlock>{`# LDAP / Active Directory
LDAP_URL=ldap://dc.yourdomain.local:389
# Или для LDAPS:
# LDAP_URL=ldaps://dc.yourdomain.local:636

LDAP_BIND_DN=CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local
LDAP_BIND_PASSWORD=YourServiceAccountPassword
LDAP_BASE_DN=DC=yourdomain,DC=local
LDAP_SEARCH_FILTER=(|(sAMAccountName={{username}})(userPrincipalName={{username}}))

# TLS (для ldaps://)
LDAP_TLS_REJECT_UNAUTHORIZED=false
# Или укажите путь к CA:
# LDAP_TLS_CA_PATH=/etc/ssl/certs/domain-ca.crt

# JWT
JWT_SECRET=your-super-secret-key-here
SESSION_SECRET=another-secret-key`}</CodeBlock>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-2">📄 ldap-client.js — клиент с логированием</h3>
        <p className="text-slate-400 text-sm mb-3">Ключевой момент — <strong className="text-white">подробное логирование</strong> на каждом этапе.</p>
        <CodeBlock>{`const ldap = require('ldapjs');
const fs = require('fs');

function createLdapClient() {
  const tlsOptions = {};

  // Если LDAPS — настраиваем TLS
  if (process.env.LDAP_URL?.startsWith('ldaps://')) {
    tlsOptions.rejectUnauthorized = 
      process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false';
    
    if (process.env.LDAP_TLS_CA_PATH) {
      tlsOptions.ca = [fs.readFileSync(process.env.LDAP_TLS_CA_PATH)];
    }
  }

  const client = ldap.createClient({
    url: process.env.LDAP_URL,
    tlsOptions,
    timeout: 10000,
    connectTimeout: 10000,
  });

  // Логирование ошибок соединения
  client.on('error', (err) => {
    console.error('[LDAP] Connection error:', err.message);
  });

  return client;
}

async function authenticateUser(username, password) {
  const client = createLdapClient();

  return new Promise((resolve, reject) => {
    // 1. Bind сервисной учёткой (для поиска)
    console.log('[LDAP] Binding as service account:', process.env.LDAP_BIND_DN);
    
    client.bind(
      process.env.LDAP_BIND_DN,
      process.env.LDAP_BIND_PASSWORD,
      (bindErr) => {
        if (bindErr) {
          console.error('[LDAP] Bind failed:', bindErr.message);
          client.unbind(() => {});
          return reject(new Error('LDAP bind failed: ' + bindErr.message));
        }

        console.log('[LDAP] Bind successful');

        // 2. Поиск пользователя
        const filter = process.env.LDAP_SEARCH_FILTER
          .replace('{{username}}', login);
        
        console.log('[LDAP] Searching with filter:', filter);
        console.log('[LDAP] Base DN:', process.env.LDAP_BASE_DN);

        const searchOpts = {
          filter,
          scope: 'sub',
          attributes: [
            'sAMAccountName', 
            'userPrincipalName', 
            'displayName', 
            'mail',
            'memberOf',
            'distinguishedName'
          ],
        };

        client.search(process.env.LDAP_BASE_DN, searchOpts, (searchErr, res) => {
          if (searchErr) {
            console.error('[LDAP] Search failed:', searchErr.message);
            client.unbind(() => {});
            return reject(new Error('LDAP search failed: ' + searchErr.message));
          }

          const entries = [];

          res.on('searchEntry', (entry) => {
            entries.push(entry.object || entry.pojo);
            console.log('[LDAP] Found entry:', entry.object?.dn || entry.pojo?.objectName);
          });

          res.on('error', (err) => {
            console.error('[LDAP] Search error event:', err.message);
          });

          res.on('end', () => {
            console.log('[LDAP] Search ended. Entries found:', entries.length);

            if (entries.length === 0) {
              client.unbind(() => {});
              return reject(new Error('User not found in AD'));
            }

            const user = entries[0];
            const userDN = user.dn || user.objectName;

            console.log('[LDAP] Attempting user bind for:', userDN);

            // 3. Bind самим пользователем (проверка пароля)
            client.bind(userDN, password, (userBindErr) => {
              if (userBindErr) {
                console.error('[LDAP] User bind failed (wrong password):', userBindErr.message);
                client.unbind(() => {});
                return reject(new Error('Invalid password'));
              }

              console.log('[LDAP] User authenticated successfully!');
              console.log('[LDAP] User DN:', userDN);
              console.log('[LDAP] Display name:', user.displayName);

              client.unbind(() => {});
              resolve({
                dn: userDN,
                username: user.sAMAccountName || username,
                displayName: user.displayName || '',
                email: user.mail || user.userPrincipalName || '',
                groups: user.memberOf || [],
              });
            });
          });
        });
      }
    );
  });
}

module.exports = { authenticateUser };`}</CodeBlock>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-2">📄 routes/auth.js — маршрут логина</h3>
        <CodeBlock>{`const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('../ldap-client');

const router = express.Router();

router.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('[AUTH] Login attempt:', username);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Аутентификация через AD
    const user = await authenticateUser(username, password);

    // Создание JWT-токена
    const token = jwt.sign(
      {
        id: user.dn,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('[AUTH] Login successful for:', user.username);

    res.json({
      token,
      user: {
        username: user.username,
        displayName: user.displayName,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('[AUTH] Login failed:', err.message);
    
    // ✅ Только ASCII в заголовках!
    res.setHeader('WWW-Authenticate', 'Bearer realm="uniontrip", error="invalid_credentials"');
    res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Неверное имя пользователя или пароль'
    });
  }
});

// Проверка авторизации (для nginx auth_request)
router.get('/api/auth/check', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  // Или из cookie:
  // const token = req.cookies?.token;

  if (!token) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="uniontrip"');
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    res.status(200).json({ user: decoded });
  } catch (err) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="uniontrip", error="invalid_token"');
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;`}</CodeBlock>
      </div>

      <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/30">
        <h3 className="text-blue-300 font-bold text-lg mb-3">💡 Как читать логи</h3>
        <p className="text-slate-300 text-sm mb-3">
          После включения логирования, при попытке входа в консоли Node.js (или pm2 logs) вы увидите:
        </p>
        <CodeBlock>{`[AUTH] Login attempt: ivanov
[LDAP] Binding as service account: CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local
[LDAP] Bind successful                          ← ✅ сервисная учётка работает
[LDAP] Searching with filter: (|(sAMAccountName=ivanov)(userPrincipalName=ivanov))
[LDAP] Base DN: DC=yourdomain,DC=local
[LDAP] Found entry: CN=Ivanov Ivan,OU=Users,DC=yourdomain,DC=local
[LDAP] Search ended. Entries found: 1            ← ✅ пользователь найден
[LDAP] Attempting user bind for: CN=Ivanov Ivan,OU=Users,DC=yourdomain,DC=local
[LDAP] User authenticated successfully!          ← ✅ пароль верный
[AUTH] Login successful for: ivanov              ← ✅ всё работает!`}</CodeBlock>
        <p className="text-slate-400 text-sm mt-3">
          Если лог обрывается раньше — смотрите, на каком шаге произошла ошибка. 
          Сообщение после <code className="bg-slate-700 px-1 rounded text-amber-300">[LDAP]</code> укажет точную причину.
        </p>
      </div>
    </div>
  );
}

/* ============================ COMMANDS SECTION ============================ */
function CommandsSection() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">🖥️ Linux — диагностика LDAP</h3>
        <CodeBlock>{`# === Сетевая доступность ===
# Проверить DNS
nslookup dc.yourdomain.local
host dc.yourdomain.local

# Проверить порт LDAP
nc -zv dc.yourdomain.local 389
nc -zv dc.yourdomain.local 636

# === LDAP-запросы ===
# Установить ldap-utils (если нет)
sudo apt-get install ldap-utils

# Поиск пользователя
ldapsearch -x -H ldap://dc.yourdomain.local \\
  -D "CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local" \\
  -W \\
  -b "DC=yourdomain,DC=local" \\
  "(sAMAccountName=ivanov)"

# Поиск по email (UPN)
ldapsearch -x -H ldap://dc.yourdomain.local \\
  -D "CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local" \\
  -W \\
  -b "DC=yourdomain,DC=local" \\
  "(userPrincipalName=ivanov@yourdomain.local)"

# Посмотреть все OU
ldapsearch -x -H ldap://dc.yourdomain.local \\
  -D "CN=svc_ldap,OU=Service Accounts,DC=yourdomain,DC=local" \\
  -W \\
  -b "DC=yourdomain,DC=local" \\
  "(objectClass=organizationalUnit)" dn

# === Проверка TLS ===
openssl s_client -connect dc.yourdomain.local:636 -showcerts

# === Логи Node.js ===
pm2 logs uniontrip --lines 100
# или
journalctl -u uniontrip -f`}</CodeBlock>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">🪟 Windows / PowerShell — диагностика</h3>
        <CodeBlock>{`# Проверить доступность DC
Test-NetConnection -ComputerName dc.yourdomain.local -Port 389
Test-NetConnection -ComputerName dc.yourdomain.local -Port 636

# Поиск пользователя через PowerShell AD модуль
Import-Module ActiveDirectory
Get-ADUser -Identity ivanov -Properties *
Get-ADUser -Filter { SamAccountName -eq "ivanov" } -Properties DisplayName, EmailAddress, MemberOf

# Проверить, не заблокирована ли учётка
Get-ADUser -Identity ivanov -Properties LockedOut, Enabled
# Если LockedOut = True:
Unlock-ADAccount -Identity ivanov

# Проверить пароль сервисной учётки
# (запустите от имени другого пользователя)
runas /user:yourdomain\\svc_ldap cmd

# Экспорт CA-сертификата домена
# (на контроллере домена)
certlm.msc  →  Trusted Root Certification Authorities  →  Export`}</CodeBlock>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">🔧 Быстрая проверка .env на ошибки</h3>
        <CodeBlock>{`# Проверить, что в .env нет лишних пробелов/символов
cat -A .env | grep LDAP
# Покажет невидимые символы:
# ^I = tab (недопустим!)
# ^M = carriage return (недопустим!)
# $ = конец строки (нормально)

# Исправить, если есть ^M (Windows line endings):
sed -i 's/\\r$//' .env

# Проверить, что переменные доступны в Node.js
node -e "require('dotenv').config(); console.log('BIND_DN:', process.env.LDAP_BIND_DN); console.log('URL:', process.env.LDAP_URL);"

# Перезапустить и смотреть логи
pm2 restart uniontrip && pm2 logs uniontrip --lines 50`}</CodeBlock>
      </div>

      <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <h3 className="text-emerald-300 font-bold text-lg mb-3">📊 Порядок действий при отладке</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="pb-2 pr-4">Шаг</th>
                <th className="pb-2 pr-4">Действие</th>
                <th className="pb-2">Если не работает</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800">
                <td className="py-2 pr-4 text-emerald-400 font-bold">1</td>
                <td className="py-2 pr-4">nc -zv DC 389</td>
                <td className="py-2">Firewall / сеть → шаг 1 диагностики</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2 pr-4 text-emerald-400 font-bold">2</td>
                <td className="py-2 pr-4">ldapsearch с bind DN</td>
                <td className="py-2">Bind DN / пароль → шаг 3 диагностики</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2 pr-4 text-emerald-400 font-bold">3</td>
                <td className="py-2 pr-4">ldapsearch с фильтром</td>
                <td className="py-2">Base DN / filter → шаг 4 диагностики</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2 pr-4 text-emerald-400 font-bold">4</td>
                <td className="py-2 pr-4">cat -A .env</td>
                <td className="py-2">Невидимые символы → sed -i 's/\\r$//'</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="py-2 pr-4 text-emerald-400 font-bold">5</td>
                <td className="py-2 pr-4">pm2 logs (попытка входа)</td>
                <td className="py-2">Смотреть, на каком шаге обрывается лог</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-emerald-400 font-bold">6</td>
                <td className="py-2 pr-4">curl -X POST /api/auth/login</td>
                <td className="py-2">Проверить ответ и статус</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================ SHARED COMPONENTS ============================ */
function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-slate-900/80 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed border border-slate-700/30">
      <code className="text-slate-300">{children}</code>
    </pre>
  );
}

export default App;
