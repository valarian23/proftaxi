/**
 * API-клиент для взаимодействия с бэкендом.
 * В продакшене обращается к Node.js серверу.
 * В демо-режиме (без бэкенда) использует localStorage.
 */

import { Trip, Booking, TripFormData, BookingFormData, User } from './types';

// Базовый URL API. В продакшене Nginx проксирует /api на Node.js сервер
const API_BASE = '/api';

// Флаг: доступен ли бэкенд (определяется при первом запросе)
let backendAvailable: boolean | null = null;

/** Проверка доступности бэкенда */
async function checkBackend(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  try {
    const response = await fetch(`${API_BASE}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000) 
    });
    backendAvailable = response.ok;
  } catch {
    backendAvailable = false;
  }
  return backendAvailable;
}

// ==================== DEMO MODE (localStorage) ====================

const STORAGE_KEYS = {
  trips: 'carpool_trips',
  bookings: 'carpool_bookings',
  user: 'carpool_user',
};

function getStoredTrips(): Trip[] {
  const data = localStorage.getItem(STORAGE_KEYS.trips);
  return data ? JSON.parse(data) : [];
}

function saveTrips(trips: Trip[]): void {
  localStorage.setItem(STORAGE_KEYS.trips, JSON.stringify(trips));
}

function getStoredBookings(): Booking[] {
  const data = localStorage.getItem(STORAGE_KEYS.bookings);
  return data ? JSON.parse(data) : [];
}

function saveBookings(bookings: Booking[]): void {
  localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(bookings));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Демо-данные для первого запуска
function initDemoData(): void {
  if (localStorage.getItem(STORAGE_KEYS.trips)) return;
  
  const demoTrips: Trip[] = [
    {
      id: 'demo1',
      driverId: 'ivanov',
      driverName: 'Иванов Иван Петрович',
      driverPhone: '+7 (999) 123-45-67',
      carModel: 'Toyota Camry',
      carColor: 'Серебристый',
      carPlate: 'А123БВ77',
      date: getTomorrowDate(),
      time: '08:00',
      departure: 'мкр. Южный, д. 15',
      destination: 'Предприятие, проходная №1',
      totalSeats: 3,
      bookedSeats: 1,
      pricePerPerson: 150,
      comment: 'Заезжаю за пассажирами по маршруту',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo2',
      driverId: 'petrov',
      driverName: 'Петров Сергей Алексеевич',
      driverPhone: '+7 (999) 987-65-43',
      carModel: 'Kia Rio',
      carColor: 'Чёрный',
      carPlate: 'Е456ОР77',
      date: getTomorrowDate(),
      time: '07:30',
      departure: 'мкр. Северный, д. 8',
      destination: 'Предприятие, проходная №1',
      totalSeats: 3,
      bookedSeats: 0,
      pricePerPerson: 100,
      comment: '',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo3',
      driverId: 'sidorov',
      driverName: 'Сидоров Алексей Михайлович',
      driverPhone: '+7 (999) 555-33-22',
      carModel: 'Hyundai Solaris',
      carColor: 'Белый',
      carPlate: 'К789МН77',
      date: getTomorrowDate(),
      time: '08:30',
      departure: 'мкр. Центральный, ТЦ "Галактика"',
      destination: 'Предприятие, проходная №2',
      totalSeats: 2,
      bookedSeats: 0,
      pricePerPerson: 120,
      comment: 'Есть место для багажа',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  ];
  
  const demoBookings: Booking[] = [
    {
      id: 'book1',
      tripId: 'demo1',
      passengerId: 'kuznetsov',
      passengerName: 'Кузнецов Дмитрий Валерьевич',
      passengerPhone: '+7 (999) 111-22-33',
      seatsCount: 1,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }
  ];
  
  saveTrips(demoTrips);
  saveBookings(demoBookings);
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ==================== API METHODS ====================

/** Получить текущего пользователя */
export async function getCurrentUser(): Promise<User | null> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (res.ok) return await res.json();
    } catch { /* fallback to demo */ }
  }
  
  // Демо-режим: возвращаем тестового пользователя
  const stored = localStorage.getItem(STORAGE_KEYS.user);
  if (stored) return JSON.parse(stored);
  
  const demoUser: User = {
    id: 'demo_user',
    username: 'demo_user',
    displayName: 'Демонстрационный Пользователь',
    role: 'both',
  };
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(demoUser));
  return demoUser;
}

/** Установить данные пользователя (для демо-режима) */
export function setCurrentUser(user: User): void {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

/** Получить список активных поездок */
export async function getTrips(): Promise<Trip[]> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/trips`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
  }
  
  initDemoData();
  return getStoredTrips().filter(t => t.status === 'active');
}

/** Получить все поездки пользователя (как водителя) */
export async function getMyTrips(driverId: string): Promise<Trip[]> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/trips/my?driverId=${driverId}`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
  }
  
  initDemoData();
  return getStoredTrips().filter(t => t.driverId === driverId);
}

/** Получить бронирования пользователя (как пассажира) */
export async function getMyBookings(passengerId: string): Promise<(Booking & { trip: Trip })[]> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/bookings/my?passengerId=${passengerId}`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
  }
  
  initDemoData();
  const bookings = getStoredBookings().filter(b => b.passengerId === passengerId);
  const trips = getStoredTrips();
  return bookings.map(b => ({
    ...b,
    trip: trips.find(t => t.id === b.tripId)!,
  })).filter(b => b.trip);
}

/** Создать поездку */
export async function createTrip(data: TripFormData, user: User): Promise<Trip> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, driverId: user.id, driverName: user.displayName }),
      });
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
  }
  
  initDemoData();
  const trip: Trip = {
    id: generateId(),
    driverId: user.id,
    driverName: user.displayName,
    driverPhone: data.driverPhone,
    carModel: data.carModel,
    carColor: data.carColor,
    carPlate: data.carPlate,
    date: data.date,
    time: data.time,
    departure: data.departure,
    destination: data.destination,
    totalSeats: data.totalSeats,
    bookedSeats: 0,
    pricePerPerson: data.pricePerPerson,
    comment: data.comment,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  
  const trips = getStoredTrips();
  trips.push(trip);
  saveTrips(trips);
  return trip;
}

/** Забронировать место */
export async function createBooking(tripId: string, data: BookingFormData, user: User): Promise<Booking> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          passengerId: user.id,
          passengerName: user.displayName,
          passengerPhone: data.passengerPhone,
          seatsCount: data.seatsCount,
        }),
      });
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
  }
  
  initDemoData();
  const trips = getStoredTrips();
  const tripIndex = trips.findIndex(t => t.id === tripId);
  if (tripIndex === -1) throw new Error('Поездка не найдена');
  
  const trip = trips[tripIndex];
  const availableSeats = trip.totalSeats - trip.bookedSeats;
  if (data.seatsCount > availableSeats) {
    throw new Error(`Недостаточно свободных мест. Доступно: ${availableSeats}`);
  }
  
  // Обновляем количество занятых мест
  trips[tripIndex] = { ...trip, bookedSeats: trip.bookedSeats + data.seatsCount };
  saveTrips(trips);
  
  const booking: Booking = {
    id: generateId(),
    tripId,
    passengerId: user.id,
    passengerName: user.displayName,
    passengerPhone: data.passengerPhone,
    seatsCount: data.seatsCount,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  
  const bookings = getStoredBookings();
  bookings.push(booking);
  saveBookings(bookings);
  
  return booking;
}

/** Отменить поездку */
export async function cancelTrip(tripId: string): Promise<void> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/trips/${tripId}/cancel`, { method: 'PUT' });
      if (res.ok) return;
    } catch { /* fallback */ }
  }
  
  initDemoData();
  const trips = getStoredTrips();
  const idx = trips.findIndex(t => t.id === tripId);
  if (idx !== -1) {
    trips[idx] = { ...trips[idx], status: 'cancelled' };
    saveTrips(trips);
  }
}

/** Отменить бронирование */
export async function cancelBooking(bookingId: string): Promise<void> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, { method: 'PUT' });
      if (res.ok) return;
    } catch { /* fallback */ }
  }
  
  initDemoData();
  const bookings = getStoredBookings();
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx === -1) return;
  
  const booking = bookings[idx];
  bookings[idx] = { ...booking, status: 'cancelled' };
  saveBookings(bookings);
  
  // Освобождаем места
  const trips = getStoredTrips();
  const tripIdx = trips.findIndex(t => t.id === booking.tripId);
  if (tripIdx !== -1) {
    trips[tripIdx] = { 
      ...trips[tripIdx], 
      bookedSeats: Math.max(0, trips[tripIdx].bookedSeats - booking.seatsCount) 
    };
    saveTrips(trips);
  }
}
