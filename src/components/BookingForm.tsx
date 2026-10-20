/**
 * Модальная форма бронирования места в поездке (для пассажиров)
 */

import { useState } from 'react';
import { Trip, User, BookingFormData } from '../types';
import { createBooking } from '../api';

interface BookingFormProps {
  trip: Trip;
  user: User;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BookingForm({ trip, user, onSuccess, onCancel }: BookingFormProps) {
  const savedPhone = localStorage.getItem('carpool_saved_phone') || '';
  
  const [formData, setFormData] = useState<BookingFormData>({
    passengerPhone: savedPhone,
    seatsCount: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableSeats = trip.totalSeats - trip.bookedSeats;

  function handleChange(field: keyof BookingFormData, value: string | number) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.passengerPhone.trim()) {
      setError('Укажите контактный телефон');
      return;
    }
    if (formData.seatsCount < 1) {
      setError('Количество мест должно быть не менее 1');
      return;
    }
    if (formData.seatsCount > availableSeats) {
      setError(`Доступно только ${availableSeats} мест`);
      return;
    }

    setLoading(true);
    try {
      // Сохраняем телефон для будущих бронирований
      localStorage.setItem('carpool_saved_phone', formData.passengerPhone);
      
      await createBooking(trip.id, formData, user);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка бронирования');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Заголовок */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Бронирование места</h2>
          <p className="text-sm text-gray-500 mt-1">Заполните данные для бронирования</p>
        </div>

        {/* Информация о поездке */}
        <div className="p-6 bg-blue-50 border-b border-blue-100">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Водитель:</span>
              <span className="font-medium text-gray-800">{trip.driverName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Телефон водителя:</span>
              <a href={`tel:${trip.driverPhone}`} className="font-medium text-blue-600">
                {trip.driverPhone}
              </a>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Автомобиль:</span>
              <span className="font-medium text-gray-800">
                {trip.carModel} ({trip.carColor}) {trip.carPlate}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Дата и время:</span>
              <span className="font-medium text-gray-800">
                {new Date(trip.date + 'T00:00:00').toLocaleDateString('ru-RU')}, {trip.time}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Маршрут:</span>
              <span className="font-medium text-gray-800 text-right text-sm">
                {trip.departure} → {trip.destination}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Стоимость:</span>
              <span className="font-bold text-green-600">
                {trip.pricePerPerson > 0 ? `${trip.pricePerPerson} ₽` : 'Бесплатно'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Свободно мест:</span>
              <span className={`font-bold ${availableSeats <= 1 ? 'text-orange-600' : 'text-green-600'}`}>
                {availableSeats} из {trip.totalSeats}
              </span>
            </div>
          </div>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ваш контактный телефон *
            </label>
            <input
              type="tel"
              value={formData.passengerPhone}
              onChange={(e) => handleChange('passengerPhone', e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Водитель свяжется с вами для уточнения деталей
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Количество мест *
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleChange('seatsCount', Math.max(1, formData.seatsCount - 1))}
                className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-bold"
              >
                −
              </button>
              <span className="text-2xl font-bold text-gray-800 w-8 text-center">
                {formData.seatsCount}
              </span>
              <button
                type="button"
                onClick={() => handleChange('seatsCount', Math.min(availableSeats, formData.seatsCount + 1))}
                className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-bold"
              >
                +
              </button>
              <span className="text-sm text-gray-500 ml-2">
                (макс. {availableSeats})
              </span>
            </div>
          </div>

          {/* Итого */}
          {trip.pricePerPerson > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-800">Итого к оплате:</span>
                <span className="text-lg font-bold text-green-700">
                  {trip.pricePerPerson * formData.seatsCount} ₽
                </span>
              </div>
            </div>
          )}

          {/* Ошибка */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Бронирование...' : 'Забронировать'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
