import { useState } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState<'problem' | 'solution' | 'code'>('problem');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <span className="text-red-400 text-xl">🔧</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Диагностика ошибки авторизации</h1>
            <p className="text-sm text-slate-400">uniontrip.knaaz.ru — nginx auth_request + Node.js</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Error Summary */}
        <div className="mb-8 p-5 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-2xl mt-0.5">⚠️</span>
            <div>
              <h2 className="text-red-300 font-semibold text-lg mb-2">Обнаруженные ошибки</h2>
              <div className="space-y-2 font-mono text-sm">
                <p className="text-red-200/80 bg-red-900/30 rounded px-3 py-1.5">
                  TypeError [ERR_INVALID_CHAR]: Invalid character in header content ["WWW-Authenticate"]
                </p>
                <p className="text-red-200/80 bg-red-900/30 rounded px-3 py-1.5">
                  auth request unexpected status: 500 while sending to client
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1">
          {[
            { id: 'problem' as const, label: '🔍 Причина', icon: '' },
            { id: 'solution' as const, label: '✅ Решение', icon: '' },
            { id: 'code' as const, label: '💻 Код', icon: '' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'problem' && <ProblemSection />}
        {activeTab === 'solution' && <SolutionSection />}
        {activeTab === 'code' && <CodeSection />}

        {/* Quick Checklist */}
        <div className="mt-10 p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <h3 className="text-emerald-300 font-bold text-lg mb-4 flex items-center gap-2">
            <span>📋</span> Быстрый чек-лист
          </h3>
          <ol className="space-y-3 text-slate-300">
            {[
              'Найти в коде все места, где устанавливается заголовок WWW-Authenticate',
              'Убедиться, что значение содержит ТОЛЬКО ASCII-символы (латиница, цифры, пробелы)',
              'Заменить кириллицу на английский текст или URL-encode',
              'Убрать переносы строк \\n, \\r из значения заголовка',
              'Перезапустить Node.js-сервер (pm2 restart / systemctl restart)',
              'Проверить: curl -I https://uniontrip.knaaz.ru/auth — должен вернуть 401, а не 500',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-12 py-6 text-center text-slate-500 text-sm">
        Диагностика для uniontrip.knaaz.ru • {new Date().toLocaleDateString('ru-RU')}
      </footer>
    </div>
  );
}

function ProblemSection() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">🔗 Цепочка ошибки</h3>
        <div className="flex flex-col gap-3">
          {[
            { step: '1', title: 'Клиент → nginx', desc: 'GET / HTTP/1.1', color: 'blue' },
            { step: '2', title: 'nginx → auth_request', desc: 'Внутренний запрос к /auth (Node.js бэкенд)', color: 'purple' },
            { step: '3', title: 'Node.js → crash', desc: 'setHeader("WWW-Authenticate", "...кириллица...") → ERR_INVALID_CHAR', color: 'red' },
            { step: '4', title: 'nginx получает 500', desc: 'auth_request unexpected status: 500', color: 'orange' },
            { step: '5', title: 'Клиент получает ошибку', desc: 'Авторизация не срабатывает', color: 'red' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                item.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                item.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                item.color === 'red' ? 'bg-red-500/20 text-red-400' :
                'bg-orange-500/20 text-orange-400'
              }`}>
                {item.step}
              </div>
              <div className="flex-1 bg-slate-900/50 rounded-lg p-3">
                <div className="text-sm font-medium text-white">{item.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
              </div>
              {i < 4 && (
                <div className="text-slate-600 text-lg">↓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">🎯 Почему это происходит</h3>
        <div className="space-y-4 text-slate-300">
          <p>
            Начиная с <strong className="text-white">Node.js 14+</strong> (и особенно в Node.js 18/20), 
            HTTP-модуль строго валидирует все значения заголовков. Заголовок <code className="bg-slate-700 px-2 py-0.5 rounded text-amber-300 text-sm">WWW-Authenticate</code> должен содержать 
            <strong className="text-white"> только ASCII-символы</strong>.
          </p>
          <p>Недопустимые символы:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="text-red-400 font-medium text-sm mb-2">❌ Запрещено</div>
              <ul className="text-sm space-y-1 text-slate-400">
                <li>• Кириллица: <code className="text-red-300">"Требуется вход"</code></li>
                <li>• Переносы строк: <code className="text-red-300">{'\n'}</code>, <code className="text-red-300">{'\r'}</code></li>
                <li>• Управляющие символы (0x00-0x1F)</li>
                <li>• Символы вне ASCII (emoji, CJK и т.д.)</li>
              </ul>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="text-emerald-400 font-medium text-sm mb-2">✅ Разрешено</div>
              <ul className="text-sm space-y-1 text-slate-400">
                <li>• Латиница: <code className="text-emerald-300">"Authorization required"</code></li>
                <li>• Цифры и стандартные символы</li>
                <li>• Пробелы, дефисы, подчёркивания</li>
                <li>• URL-encoded значения: <code className="text-emerald-300">%D0%92%D1%85%D0%BE%D0%B4</code></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SolutionSection() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">⚡ Быстрое исправление</h3>
        <p className="text-slate-300 mb-4">
          Найдите в коде вашего Node.js-приложения (auth middleware / контроллер) место, 
          где устанавливается заголовок <code className="bg-slate-700 px-2 py-0.5 rounded text-amber-300 text-sm">WWW-Authenticate</code>, 
          и замените кириллицу на английский текст:
        </p>

        <div className="space-y-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <div className="text-red-400 text-xs font-medium mb-2 uppercase tracking-wide">❌ Было (вызывает ошибку)</div>
            <pre className="text-sm text-red-200/80 overflow-x-auto">
{`res.setHeader('WWW-Authenticate', 'Bearer realm="Требуется авторизация"');
// или
res.set('WWW-Authenticate', 'Basic realm="Введите логин и пароль"');
// или
response.writeHead(401, { 'WWW-Authenticate': 'Bearer error="Неверный токен"' });`}
            </pre>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
            <div className="text-emerald-400 text-xs font-medium mb-2 uppercase tracking-wide">✅ Стало (работает)</div>
            <pre className="text-sm text-emerald-200/80 overflow-x-auto">
{`res.setHeader('WWW-Authenticate', 'Bearer realm="Authorization required"');
// или
res.set('WWW-Authenticate', 'Basic realm="Login required"');
// или
response.writeHead(401, { 'WWW-Authenticate': 'Bearer error="invalid_token"' });`}
            </pre>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">🔧 Если используется Express + passport / JWT</h3>
        <p className="text-slate-300 mb-4">
          Проверьте конфигурацию стратегии аутентификации. Некоторые библиотеки автоматически 
          формируют заголовок <code className="bg-slate-700 px-2 py-0.5 rounded text-amber-300 text-sm">WWW-Authenticate</code> с кастомным сообщением.
        </p>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-4">
          <div className="text-amber-400 text-xs font-medium mb-2 uppercase tracking-wide">⚠️ Проверьте эти файлы</div>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• <code className="text-amber-300">auth.js</code> / <code className="text-amber-300">auth.ts</code> — middleware авторизации</li>
            <li>• <code className="text-amber-300">passport.js</code> — конфигурация стратегий</li>
            <li>• <code className="text-amber-300">jwt.strategy.js</code> — обработка ошибок JWT</li>
            <li>• Любой файл с <code className="text-amber-300">res.status(401)</code> или <code className="text-amber-300">res.writeHead(401)</code></li>
          </ul>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wide">Поиск по проекту</div>
          <pre className="text-sm text-slate-300 overflow-x-auto">
{`# Найти все места с WWW-Authenticate
grep -rn "WWW-Authenticate" ./src/
grep -rn "WWW-Authenticate" ./app/

# Или найти все ответы 401
grep -rn "status(401)" ./src/
grep -rn "writeHead(401" ./src/

# Поиск кириллицы в заголовках
grep -rn "WWW-Authenticate.*[а-яА-Я]" ./src/`}
          </pre>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">🔄 После исправления</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">1.</span>
            <div className="text-slate-300">
              <p>Перезапустите Node.js-сервер:</p>
              <pre className="mt-2 bg-slate-900/50 rounded px-3 py-2 text-sm text-slate-300 overflow-x-auto">
{`pm2 restart uniontrip
# или
systemctl restart uniontrip
# или
docker restart uniontrip-app`}
              </pre>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">2.</span>
            <div className="text-slate-300">
              <p>Проверьте, что auth endpoint возвращает 401 (а не 500):</p>
              <pre className="mt-2 bg-slate-900/50 rounded px-3 py-2 text-sm text-slate-300 overflow-x-auto">
{`curl -I https://uniontrip.knaaz.ru/auth
# Ожидаемый результат: HTTP/1.1 401 Unauthorized`}
              </pre>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-emerald-400">3.</span>
            <div className="text-slate-300">
              <p>Проверьте логи — ошибка должна исчезнуть:</p>
              <pre className="mt-2 bg-slate-900/50 rounded px-3 py-2 text-sm text-slate-300 overflow-x-auto">
{`pm2 logs uniontrip
# или
journalctl -u uniontrip -f`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeSection() {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">📄 Пример: Express middleware (исправленный)</h3>
        <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">
          <code className="text-slate-300">
{`// middleware/auth.js

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // ✅ Только ASCII в заголовке!
    res.setHeader(
      'WWW-Authenticate', 
      'Bearer realm="uniontrip", error="invalid_request", error_description="Access token required"'
    );
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Требуется токен авторизации' // сообщение в теле — кириллица ОК
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // ✅ Только ASCII в заголовке!
      res.setHeader(
        'WWW-Authenticate',
        'Bearer realm="uniontrip", error="invalid_token", error_description="Token expired or invalid"'
      );
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Токен недействителен' // в теле ответа — кириллица ОК
      });
    }
    req.user = user;
    next();
  });
};`}
          </code>
        </pre>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">📄 Пример: Passport.js стратегия</h3>
        <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">
          <code className="text-slate-300">
{`// strategies/jwt.strategy.js
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  // ✅ Важно: если есть custom callback для 401, 
  //    убедитесь что WWW-Authenticate на английском
};

// Если используете passport с кастомным failureResponse:
passport.use(new JwtStrategy(opts, (jwtPayload, done) => {
  User.findById(jwtPayload.id)
    .then(user => {
      if (user) return done(null, user);
      return done(null, false);
    })
    .catch(err => done(err, false));
}));

// В маршруте:
router.get('/api/protected',
  passport.authenticate('jwt', { 
    session: false,
    // ✅ failureMessage на английском или без кастомного заголовка
    failureMessage: false  
  }),
  (req, res) => {
    res.json({ data: 'protected content' });
  }
);`}
          </code>
        </pre>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-white font-bold text-lg mb-4">📄 Пример: nginx auth_request конфигурация</h3>
        <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">
          <code className="text-slate-300">
{`# /etc/nginx/sites-available/uniontrip.knaaz.ru

server {
    listen 443 ssl;
    server_name uniontrip.knaaz.ru;

    # Основной location с auth_request
    location / {
        auth_request /auth-check;
        auth_request_set $auth_status $upstream_status;
        
        # Если auth вернул 401 — перенаправляем на логин
        error_page 401 = /login;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Внутренний endpoint для проверки авторизации
    location = /auth-check {
        internal;
        proxy_pass http://127.0.0.1:3000/api/auth/check;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Authorization $http_authorization;
    }

    # Страница логина — без auth_request
    location /login {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}`}
          </code>
        </pre>
      </div>

      <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/30">
        <h3 className="text-blue-300 font-bold text-lg mb-3">💡 Важное правило</h3>
        <div className="text-slate-300 space-y-2">
          <p>
            <strong className="text-white">HTTP-заголовки</strong> (headers) — только ASCII по спецификации RFC 7230.
            Node.js с версии 14+ строго это проверяет и бросает <code className="bg-slate-700 px-1.5 py-0.5 rounded text-amber-300 text-sm">ERR_INVALID_CHAR</code>.
          </p>
          <p>
            <strong className="text-white">Тело ответа</strong> (response body) — может содержать любые символы, включая кириллицу. 
            Главное — установить правильный <code className="bg-slate-700 px-1.5 py-0.5 rounded text-amber-300 text-sm">Content-Type: application/json; charset=utf-8</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
