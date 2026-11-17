import { useState, useEffect, useCallback } from 'react';
import { User, Trip } from './types';
import { getCurrentUser, setCurrentUser, checkAuth, getTrips } from './api';
import { Header } from './components/Header';
import { TripList } from './components/TripList';
import { CreateTripForm } from './components/CreateTripForm';
import { MyTrips } from './components/MyTrips';
import { MyBookings } from './components/MyBookings';
import { BookingForm } from './components/BookingForm';
import { LoginScreen } from './components/LoginScreen';

type Page = 'trips' | 'create' | 'my-trips' | 'my-bookings';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('trips');
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Загрузка данных
  const refreshData = useCallback(async () => {
    try {
      const tripsData = await getTrips();
      setTrips(tripsData);
    } catch (err) {
      console.error('Failed to load trips:', err);
    }
  }, []);

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshKey, refreshData]);

  async function checkAuthentication() {
    try {
      setLoading(true);

      // Пытаемся получить текущего пользователя через NTLM/SSO
      const authResult = await checkAuth();

      if (authResult.success && authResult.user) {
        // Авторизация успешна (NTLM/Kerberos через Nginx)
        const loggedInUser: User = {
          id: authResult.user.id || authResult.user.username,
          username: authResult.user.username,
          displayName: authResult.user.displayName || authResult.user.username,
          role: (authResult.user.role as User['role']) || 'both',
        };
        setUser(loggedInUser);
        setCurrentUser(loggedInUser);
      } else {
        // NTLM не сработал — проверяем localStorage (демо-режим)
        const storedUser = await getCurrentUser();
        if (storedUser && storedUser.id !== 'demo_user') {
          setUser(storedUser);
        }
        // Если нет пользователя — покажем LoginScreen
      }
    } catch (err) {
      console.log('Auth check failed, using demo mode:', err);
      const storedUser = await getCurrentUser();
      if (storedUser && storedUser.id !== 'demo_user') {
        setUser(storedUser);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(loggedInUser: User) {
    setUser(loggedInUser);
    setCurrentUser(loggedInUser);
  }

  function handleSelectTrip(trip: Trip) {
    setSelectedTrip(trip);
  }

  function handleCloseBooking() {
    setSelectedTrip(null);
  }

  function handleBookingSuccess() {
    setSelectedTrip(null);
    setRefreshKey((k) => k + 1);
  }

  function handleTripCreated() {
    setCurrentPage('trips');
    setRefreshKey((k) => k + 1);
  }

  function handleNavigate(page: Page) {
    setCurrentPage(page);
    setSelectedTrip(null);
    setRefreshKey((k) => k + 1);
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

  // Показываем форму бронирования, если выбрана поездка
  if (selectedTrip) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header user={user} currentPage={currentPage} onNavigate={handleNavigate} />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <BookingForm
            trip={selectedTrip}
            user={user}
            onSuccess={handleBookingSuccess}
            onCancel={handleCloseBooking}
          />
        </main>
      </div>
    );
  }

  // Основное приложение
  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} currentPage={currentPage} onNavigate={handleNavigate} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {currentPage === 'trips' && (
          <TripList trips={trips} onSelectTrip={handleSelectTrip} user={user} />
        )}
        {currentPage === 'create' && (
          <CreateTripForm
            user={user}
            onSuccess={handleTripCreated}
            onCancel={() => handleNavigate('trips')}
          />
        )}
        {currentPage === 'my-trips' && (
          <MyTrips userId={user.id} onRefresh={() => setRefreshKey((k) => k + 1)} />
        )}
        {currentPage === 'my-bookings' && <MyBookings userId={user.id} />}
      </main>
    </div>
  );
}

export default App;
