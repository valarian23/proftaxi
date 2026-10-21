/**
 * Главный компонент приложения "Корпоративные поездки"
 * 
 * Архитектура:
 * - Nginx раздаёт статику (React SPA) и проксирует /api на Node.js бэкенд
 * - Авторизация через NTLM/Kerberos (модуль Nginx)
 * - Бэкенд на Node.js + Express + PostgreSQL
 * 
 * В демо-режиме (без бэкенда) данные хранятся в localStorage
 */

import { useState, useEffect } from 'react';
import { User, Trip, Booking } from './types';
import { getCurrentUser, getTrips, getMyTrips, getMyBookings } from './api';
import { Header } from './components/Header';
import { TripList } from './components/TripList';
import { CreateTripForm } from './components/CreateTripForm';
import { BookingForm } from './components/BookingForm';
import { MyTrips } from './components/MyTrips';
import { MyBookings } from './components/MyBookings';
import { LoginScreen } from './components/LoginScreen';

type Page = 'trips' | 'create' | 'my-trips' | 'my-bookings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('trips');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Загрузка текущего пользователя
  useEffect(() => {
    loadUser();
  }, []);

  // Загрузка поездок при смене страницы
  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user, page]);

  async function loadUser() {
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch {
      // Если не удалось получить пользователя — показываем экран входа
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrips() {
    try {
      const data = await getTrips();
      setTrips(data);
    } catch (err) {
      showNotification('error', 'Ошибка загрузки поездок');
    }
  }

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  function handleSelectTrip(trip: Trip) {
    setSelectedTrip(trip);
    setShowBookingForm(true);
  }

  function handleBookingSuccess() {
    setShowBookingForm(false);
    setSelectedTrip(null);
    showNotification('success', 'Место успешно забронировано!');
    loadTrips();
  }

  function handleTripCreated() {
    setPage('my-trips');
    showNotification('success', 'Поездка успешно создана!');
  }

  // Экран входа (для демо-режима)
  if (!user && !loading) {
    return <LoginScreen onLogin={(u: User) => { setUser(u); }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <Header 
        user={user!} 
        currentPage={page} 
        onNavigate={setPage} 
      />

      {/* Уведомления */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all ${
          notification.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Основной контент */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {page === 'trips' && (
          <TripList 
            trips={trips} 
            onSelectTrip={handleSelectTrip}
            user={user!}
          />
        )}

        {page === 'create' && (
          <CreateTripForm 
            user={user!}
            onSuccess={handleTripCreated}
            onCancel={() => setPage('trips')}
          />
        )}

        {page === 'my-trips' && user && (
          <MyTrips 
            userId={user.id}
            onRefresh={loadTrips}
          />
        )}

        {page === 'my-bookings' && user && (
          <MyBookings 
            userId={user.id}
          />
        )}
      </main>

      {/* Модальное окно бронирования */}
      {showBookingForm && selectedTrip && (
        <BookingForm
          trip={selectedTrip}
          user={user!}
          onSuccess={handleBookingSuccess}
          onCancel={() => { setShowBookingForm(false); setSelectedTrip(null); }}
        />
      )}
    </div>
  );
}
