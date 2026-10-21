/**
 * Список доступных поездок (для пассажиров)
 */

import { useState } from 'react';
import { Trip, User } from '../types';

interface TripListProps {
  trips: Trip[];
  onSelectTrip: (trip: Trip) => void;
  user: User;
}

export function TripList({ trips, onSelectTrip, user }: TripListProps) {
  const [filterDate, setFilterDate] = useState('');
  const [filterDestination, setFilterDestination] = useState('');

  // Фильтрация поездок
  const filteredTrips = trips.filter(trip => {
    if (filterDate && trip.date !== filterDate) return false;
    if (filterDestination) {
      const search = filterDestination.toLowerCase();
      if (
        !trip.destination.toLowerCase().includes(search) &&
        !trip.departure.toLowerCase().includes(search)
      ) return false;
    }
    // Не показываем свои поездки в списке для бронирования
    if (trip.driverId === user.id) return false;
    return true;
  });

  // Сортировка по дате и времени
  const sortedTrips = [...filteredTrips].sort((a, b) => {
    const dateA = `${a.date}T${a.time}`;
    const dateB = `${b.date}T${b.time}`;
    return dateA.localeCompare(dateB);
  });

  // Группировка по дате
  const groupedTrips: { [date: string]: Trip[] } = {};
  sortedTrips.forEach(trip => {
    if (!groupedTrips[trip.date]) {
      groupedTrips[trip.date] = [];
    }
    groupedTrips[trip.date].push(trip);
  });

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) return 'Сегодня';
    if (date.getTime() === tomorrow.getTime()) return 'Завтра';

    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  return (
    <div>
      {/* Заголовок и фильтры */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Доступные поездки</h2>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              placeholder="🔍 Поиск по маршруту..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Список поездок */}
      {Object.keys(groupedTrips).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl mb-4 block">🔍</span>
          <p className="text-gray-500 text-lg">Нет доступных поездок</p>
          <p className="text-gray-400 text-sm mt-1">
            Попробуйте изменить фильтры или создайте свою поездку
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTrips).map(([date, dateTrips]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {formatDate(date)} — {new Date(date + 'T00:00:00').toLocaleDateString('ru-RU')}
              </h3>
              <div className="space-y-3">
                {dateTrips.map(trip => (
                  <TripCard 
                    key={trip.id} 
                    trip={trip} 
                    onSelect={() => onSelectTrip(trip)}
                    isOwner={trip.driverId === user.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Карточка одной поездки */
function TripCard({ trip, onSelect, isOwner }: { trip: Trip; onSelect: () => void; isOwner: boolean }) {
  const availableSeats = trip.totalSeats - trip.bookedSeats;
  const isFull = availableSeats <= 0;

  return (
    <div className={`bg-white rounded-xl shadow-sm border p-5 transition-all hover:shadow-md ${
      isFull ? 'opacity-60' : 'hover:border-blue-200'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Основная информация */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-bold text-gray-800">{trip.time}</span>
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm font-medium text-gray-700">{trip.driverName}</span>
          </div>
          
          {/* Маршрут */}
          <div className="flex items-center gap-2 text-sm mb-2">
            <span className="text-green-600 font-medium">📍 {trip.departure}</span>
            <span className="text-gray-400">→</span>
            <span className="text-red-600 font-medium">📍 {trip.destination}</span>
          </div>

          {/* Детали */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span>🚗 {trip.carModel} ({trip.carColor})</span>
            <span>🔢 {trip.carPlate}</span>
            <span>💰 {trip.pricePerPerson} ₽/чел.</span>
          </div>

          {/* Места */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: trip.totalSeats }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < trip.bookedSeats ? 'bg-red-400' : 'bg-green-400'
                  }`}
                />
              ))}
            </div>
            <span className={`text-xs font-medium ${
              isFull ? 'text-red-600' : 'text-green-600'
            }`}>
              {isFull ? 'Мест нет' : `Свободно: ${availableSeats} из ${trip.totalSeats}`}
            </span>
          </div>

          {/* Комментарий */}
          {trip.comment && (
            <p className="mt-2 text-xs text-gray-400 italic">💬 {trip.comment}</p>
          )}
        </div>

        {/* Кнопка бронирования */}
        <div className="flex-shrink-0">
          {isOwner ? (
            <span className="inline-block px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">
              Ваша поездка
            </span>
          ) : isFull ? (
            <span className="inline-block px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm">
              Мест нет
            </span>
          ) : (
            <button
              onClick={onSelect}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm text-sm"
            >
              Забронировать
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
