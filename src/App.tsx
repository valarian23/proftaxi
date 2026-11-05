import { useState, useEffect } from 'react';
import { User } from './types';
import { getCurrentUser, setCurrentUser, checkAuth } from './api';
import { Header } from './components/Header';
import { TripList } from './components/TripList';
import { CreateTripForm } from './components/CreateTripForm';
import { MyTrips } from './components/MyTrips';
import { MyBookings } from './components/MyBookings';
import { LoginScreen } from './components/LoginScreen';

type Page = 'trips' | 'create' | 'my-trips' | 'my-bookings';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('trips');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем авторизацию при загрузке
    checkAuthentication();
  }, []);

  async function checkAuthentication() {
    try {
      setLoading(true);
      setAuthError(null);
      
      // Пытаемся получить текущего пользователя через API
      // В продакшене Nginx выполнит NTLM-авторизацию автоматически
      const authResult = await checkAuth();
      
      if (authResult.success && authResult.user) {
        // Авторизация успешна (NTLM/Kerberos или Basic Auth)
        setUser(authResult.user);
        setCurrentUser(authResult.user);
      } else {
        // Проверим, есть ли сохранённый пользователь (демо-режим)
        const storedUser = getCurrentUser();
        if (storedUser) {
          setUser(storedUser);
        } else {
          // Нет авторизации — покажем экран входа
          setAuthError(authResult.error || 'Требуется авторизация');
        }
      }
    } catch (err) {
      // Бэкенд недоступен — работаем в демо-режиме
      console.log('Backend unavailable, using demo mode');
      const storedUser = getCurrentUser();
      if (storedUser) {
        setUser(storedUser);
      }
      // Если нет сохранённого пользователя — покажем LoginScreen
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(loggedInUser: User) {
    setUser(loggedInUser);
    setAuthError(null);
  }

  // Экран загрузки
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🚘</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Корпоративные поездки
          </h2>
          <p className="text-gray-500">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  // Нет пользователя — показываем экран входа
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Основное приложение
  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        user={user} 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
      />
      
      <main className="max-w-6xl mx-auto px-4 py-6">
        {currentPage === 'trips' && <TripList user={user} />}
        {currentPage === 'create' && <CreateTripForm user={user} />}
        {currentPage === 'my-trips' && <MyTrips user={user} />}
        {currentPage === 'my-bookings' && <MyBookings user={user} />}
      </main>
    </div>
  );
}

export default App;
