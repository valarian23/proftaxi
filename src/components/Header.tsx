/**
 * Компонент шапки приложения с навигацией
 */

import { User } from '../types';

type Page = 'trips' | 'create' | 'my-trips' | 'my-bookings';

interface HeaderProps {
  user: User;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Header({ user, currentPage, onNavigate }: HeaderProps) {
  const navItems: { page: Page; label: string; icon: string }[] = [
    { page: 'trips', label: 'Поездки', icon: '🚗' },
    { page: 'create', label: 'Создать поездку', icon: '➕' },
    { page: 'my-trips', label: 'Мои поездки', icon: '📋' },
    { page: 'my-bookings', label: 'Мои бронирования', icon: '🎫' },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        {/* Верхняя часть: логотип и пользователь */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚘</span>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Корпоративные поездки</h1>
              <p className="text-xs text-gray-500">Совместный транспорт для сотрудников</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">{user.displayName}</p>
              <p className="text-xs text-gray-500">@{user.username}</p>
            </div>
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {user.displayName.charAt(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Навигация */}
        <nav className="flex gap-1 overflow-x-auto pb-0 -mb-px">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentPage === item.page
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
