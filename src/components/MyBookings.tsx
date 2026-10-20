/**
 * Компонент "Мои бронирования" — список бронирований пользователя как пассажира
 */

import { useState, useEffect } from 'react';
import { Booking, Trip } from '../types';
import { getMyBookings, cancelBooking } from '../api';

interface MyBookingsProps {
  userId: string;
}

export function MyBookings({ userId }: MyBookingsProps) {
  const [bookings, setBookings] = useState<(Booking & { trip: Trip })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [userId]);

  async function loadBookings() {
    setLoading(true);
    try {
      const data = await getMyBookings(userId);
      setBookings(data);
    } catch {
      // Обработка ошибки
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm('Вы уверены, что хотите отменить бронирование?')) {
      return;
    }
    try {
      await cancelBooking(bookingId);
      await loadBookings();
    } catch {
      alert('Ошибка отмены бронирования');
    }
  }

  function getStatusBadge(status: Booking['status']) {
    switch (status) {
      case 'confirmed':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Подтверждено</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Отменено</span>;
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 text-gray-500">Загрузка...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Мои бронирования (пассажир)</h2>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl mb-4 block">🎫</span>
          <p className="text-gray-500 text-lg">У вас пока нет бронирований</p>
          <p className="text-gray-400 text-sm mt-1">
            Выберите поездку из списка доступных и забронируйте место
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(booking.status)}
                    <span className="text-sm text-gray-500">
                      {booking.seatsCount} {booking.seatsCount === 1 ? 'место' : 'мест'}
                    </span>
                  </div>

                  {/* Информация о поездке */}
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="font-bold text-gray-800">{booking.trip.time}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">
                      {new Date(booking.trip.date + 'T00:00:00').toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="text-green-600">📍 {booking.trip.departure}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-red-600">📍 {booking.trip.destination}</span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>👤 {booking.trip.driverName}</span>
                    <a 
                      href={`tel:${booking.trip.driverPhone}`} 
                      className="text-blue-600 hover:underline"
                    >
                      📞 {booking.trip.driverPhone}
                    </a>
                    <span>🚗 {booking.trip.carModel}</span>
                    {booking.trip.pricePerPerson > 0 && (
                      <span className="font-medium text-green-600">
                        💰 {booking.trip.pricePerPerson * booking.seatsCount} ₽
                      </span>
                    )}
                  </div>
                </div>

                {booking.status === 'confirmed' && (
                  <button
                    onClick={() => handleCancelBooking(booking.id)}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    Отменить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
