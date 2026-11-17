/**
 * Компонент "Мои поездки" — список поездок, созданных пользователем как водителем
 */

import { useState, useEffect } from 'react';
import { Trip } from '../types';
import { getMyTrips, cancelTrip } from '../api';

interface MyTripsProps {
  userId: string;
  onRefresh: () => void;
}

export function MyTrips({ userId, onRefresh }: MyTripsProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyTrips();
  }, [userId]);

  async function loadMyTrips() {
    setLoading(true);
    try {
      const data = await getMyTrips(userId);
      setTrips(data);
    } catch {
      // Обработка ошибки
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelTrip(tripId: string) {
    if (!confirm('Вы уверены, что хотите отменить поездку? Все бронирования будут отменены.')) {
      return;
    }
    try {
      await cancelTrip(tripId);
      await loadMyTrips();
      onRefresh();
    } catch {
      alert('Ошибка отмены поездки');
    }
  }

  function getStatusBadge(status: Trip['status']) {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Активна</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Отменена</span>;
      case 'completed':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Завершена</span>;
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
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Мои поездки (водитель)</h2>

      {trips.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl mb-4 block">🚗</span>
          <p className="text-gray-500 text-lg">У вас пока нет поездок</p>
          <p className="text-gray-400 text-sm mt-1">
            Создайте первую поездку, чтобы пассажиры могли забронировать место
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map(trip => (
            <div key={trip.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(trip.status)}
                    <span className="text-lg font-bold text-gray-800">{trip.time}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(trip.date + 'T00:00:00').toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        weekday: 'short',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="text-green-600">📍 {trip.departure}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-red-600">📍 {trip.destination}</span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>🚗 {trip.carModel}</span>
                    <span>💺 Мест занято: {trip.bookedSeats}/{trip.totalSeats}</span>
                    <span>💰 {trip.pricePerPerson} ₽/чел.</span>
                  </div>
                </div>

                {trip.status === 'active' && (
                  <button
                    onClick={() => handleCancelTrip(trip.id)}
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
