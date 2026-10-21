// Типы данных для приложения совместных поездок

/** Информация о пользователе (из доменной авторизации) */
export interface User {
  id: string;
  username: string;       // Доменное имя (sAMAccountName)
  displayName: string;    // Отображаемое имя (ФИО)
  role: 'driver' | 'passenger' | 'both'; // Роль пользователя
}

/** Поездка, созданная водителем */
export interface Trip {
  id: string;
  driverId: string;           // ID водителя
  driverName: string;         // ФИО водителя
  driverPhone: string;        // Телефон водителя
  carModel: string;           // Марка и модель автомобиля
  carColor: string;           // Цвет автомобиля
  carPlate: string;           // Госномер автомобиля
  date: string;               // Дата поездки (YYYY-MM-DD)
  time: string;               // Время отправления (HH:MM)
  departure: string;          // Место отправления
  destination: string;        // Место назначения
  totalSeats: number;         // Общее количество мест
  bookedSeats: number;        // Забронировано мест
  pricePerPerson: number;     // Стоимость на человека (руб.)
  comment: string;            // Дополнительный комментарий
  status: 'active' | 'cancelled' | 'completed';
  createdAt: string;          // Дата создания
}

/** Бронирование места пассажиром */
export interface Booking {
  id: string;
  tripId: string;             // ID поездки
  passengerId: string;        // ID пассажира
  passengerName: string;      // ФИО пассажира
  passengerPhone: string;     // Телефон пассажира
  seatsCount: number;         // Количество мест
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

/** Форма создания поездки */
export interface TripFormData {
  carModel: string;
  carColor: string;
  carPlate: string;
  driverPhone: string;
  date: string;
  time: string;
  departure: string;
  destination: string;
  totalSeats: number;
  pricePerPerson: number;
  comment: string;
}

/** Форма бронирования */
export interface BookingFormData {
  passengerPhone: string;
  seatsCount: number;
}
