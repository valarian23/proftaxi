/**
 * Экран входа для демо-режима.
 * В продакшене авторизация происходит автоматически через NTLM/Kerberos в Nginx.
 * Этот экран нужен только для локальной разработки и демонстрации.
 */

import { useState } from 'react';
import { User } from '../types';
import { setCurrentUser } from '../api';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'driver' | 'passenger' | 'both'>('both');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) return;

    const user: User = {
      id: username.toLowerCase().replace(/\s/g, '_'),
      username: username.toLowerCase(),
      displayName: displayName.trim(),
      role,
    };

    setCurrentUser(user);
    onLogin(user);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Заголовок */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🚘</div>
            <h1 className="text-2xl font-bold text-gray-800">Корпоративные поездки</h1>
            <p className="text-gray-500 mt-2">
              Система совместных поездок на работу
            </p>
          </div>

          {/* Информация о доменной авторизации */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Демо-режим:</strong> В рабочей среде авторизация выполняется 
              автоматически по доменной учётной записи (NTLM/Kerberos). 
              Для демонстрации введите данные ниже.
            </p>
          </div>

          {/* Форма входа */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Доменное имя пользователя
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ivanov.ii"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ФИО
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Роль
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'driver' | 'passenger' | 'both')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              >
                <option value="both">Водитель и пассажир</option>
                <option value="driver">Только водитель</option>
                <option value="passenger">Только пассажир</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Войти в систему
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          v1.0.0 • Работает в закрытом контуре
        </p>
      </div>
    </div>
  );
}
