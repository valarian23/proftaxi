/**
 * Форма создания новой поездки (для водителей)
 */

import { useState } from 'react';
import { User, TripFormData } from '../types';
import { createTrip } from '../api';

interface CreateTripFormProps {
  user: User;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateTripForm({ user, onSuccess, onCancel }: CreateTripFormProps) {
  // Загрузка сохранённых данных автомобиля из localStorage
  const savedCar = localStorage.getItem('carpool_saved_car');
  const savedCarData = savedCar ? JSON.parse(savedCar) : {};

  const [formData, setFormData] = useState<TripFormData>({
    carModel: savedCarData.carModel || '',
    carColor: savedCarData.carColor || '',
    carPlate: savedCarData.carPlate || '',
    driverPhone: savedCarData.driverPhone || '',
    date: getTomorrowDate(),
    time: '08:00',
    departure: '',
    destination: '',
    totalSeats: 3,
    pricePerPerson: 100,
    comment: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getTomorrowDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  function handleChange(field: keyof TripFormData, value: string | number) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Валидация
    if (!formData.carModel.trim()) { setError('Укажите марку автомобиля'); return; }
    if (!formData.driverPhone.trim()) { setError('Укажите контактный телефон'); return; }
    if (!formData.departure.trim()) { setError('Укажите место отправления'); return; }
    if (!formData.destination.trim()) { setError('Укажите место назначения'); return; }
    if (formData.totalSeats < 1) { setError('Количество мест должно быть не менее 1'); return; }

    setLoading(true);
    try {
      // Сохраняем данные авто для будущих поездок
      localStorage.setItem('carpool_saved_car', JSON.stringify({
        carModel: formData.carModel,
        carColor: formData.carColor,
        carPlate: formData.carPlate,
        driverPhone: formData.driverPhone,
      }));

      await createTrip(formData, user);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания поездки');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Создать поездку</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
        {/* Информация о водителе */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            🚗 Информация об автомобиле
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Марка и модель *
              </label>
              <input
                type="text"
                value={formData.carModel}
                onChange={(e) => handleChange('carModel', e.target.value)}
                placeholder="Toyota Camry"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Цвет
              </label>
              <input
                type="text"
                value={formData.carColor}
                onChange={(e) => handleChange('carColor', e.target.value)}
                placeholder="Серебристый"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Госномер
              </label>
              <input
                type="text"
                value={formData.carPlate}
                onChange={(e) => handleChange('carPlate', e.target.value.toUpperCase())}
                placeholder="А123БВ77"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Контактный телефон *
              </label>
              <input
                type="tel"
                value={formData.driverPhone}
                onChange={(e) => handleChange('driverPhone', e.target.value)}
                placeholder="+7 (999) 123-45-67"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Маршрут */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            📍 Маршрут и время
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Место отправления *
              </label>
              <input
                type="text"
                value={formData.departure}
                onChange={(e) => handleChange('departure', e.target.value)}
                placeholder="мкр. Южный, д. 15"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Место назначения *
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => handleChange('destination', e.target.value)}
                placeholder="Предприятие, проходная №1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Время отправления *
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => handleChange('time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Места и стоимость */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            💺 Места и стоимость
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество мест для пассажиров *
              </label>
              <input
                type="number"
                value={formData.totalSeats}
                onChange={(e) => handleChange('totalSeats', parseInt(e.target.value) || 0)}
                min={1}
                max={7}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Не включая место водителя</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Стоимость на человека (₽)
              </label>
              <input
                type="number"
                value={formData.pricePerPerson}
                onChange={(e) => handleChange('pricePerPerson', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Укажите 0, если бесплатно</p>
            </div>
          </div>
        </div>

        {/* Комментарий */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Комментарий
          </label>
          <textarea
            value={formData.comment}
            onChange={(e) => handleChange('comment', e.target.value)}
            placeholder="Дополнительная информация для пассажиров..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          />
        </div>

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
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Создание...' : 'Создать поездку'}
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
  );
}
