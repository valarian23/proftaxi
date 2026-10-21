/**
 * Бэкенд-сервер для системы корпоративных поездок
 * 
 * Стек: Node.js + Express + PostgreSQL
 * 
 * Авторизация:
 * - В продакшене: Nginx выполняет NTLM/Kerberos-авторизацию и передаёт
 *   имя пользователя в заголовке X-Remote-User
 * - Бэкенд доверяет этому заголовку (т.к. Nginx и бэкенд в одном контуре)
 * 
 * API endpoints:
 * - GET  /api/health          — проверка работоспособности
 * - GET  /api/auth/me         — текущий пользователь
 * - GET  /api/trips           — список активных поездок
 * - GET  /api/trips/my        — мои поездки (как водитель)
 * - POST /api/trips           — создать поездку
 * - PUT  /api/trips/:id/cancel — отменить поездку
 * - POST /api/bookings        — забронировать место
 * - GET  /api/bookings/my     — мои бронирования
 * - PUT  /api/bookings/:id/cancel — отменить бронирование
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL подключение
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'carpool',
  user: process.env.DB_USER || 'carpool_user',
  password: process.env.DB_PASSWORD || '',
});

// ==================== Middleware: Авторизация ====================

/**
 * Извлекает пользователя из заголовка X-Remote-User (устанавливается Nginx при NTLM-авторизации).
 * В демо-режиме (без Nginx) можно передавать X-Demo-User.
 */
function authMiddleware(req, res, next) {
  // Заголовок от Nginx (после NTLM-авторизации)
  const remoteUser = req.headers['x-remote-user'];
  // Демо-заголовок для тестирования
  const demoUser = req.headers['x-demo-user'];
  
  const username = remoteUser || demoUser;
  
  if (!username) {
    // Если авторизация не пройдена — возвращаем демо-пользователя
    req.user = {
      id: 'demo_user',
      username: 'demo_user',
      displayName: 'Демо Пользователь',
    };
  } else {
    req.user = {
      id: username.toLowerCase(),
      username: username.toLowerCase(),
      displayName: username, // В продакшене Nginx может передавать и DisplayName
    };
  }
  
  next();
}

// Применяем авторизацию ко всем API-маршрутам
app.use('/api', authMiddleware);

// ==================== Routes ====================

// Проверка работоспособности
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Текущий пользователь
app.get('/api/auth/me', (req, res) => {
  res.json(req.user);
});

// ==================== Trips ====================

// Получить все активные поездки
app.get('/api/trips', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM trips 
      WHERE status = 'active' AND date >= CURRENT_DATE
      ORDER BY date ASC, time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения поездок:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить мои поездки (как водитель)
app.get('/api/trips/my', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM trips 
      WHERE driver_id = $1
      ORDER BY date DESC, time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения моих поездок:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создать поездку
app.post('/api/trips', async (req, res) => {
  try {
    const {
      carModel, carColor, carPlate, driverPhone,
      date, time, departure, destination,
      totalSeats, pricePerPerson, comment
    } = req.body;

    const result = await pool.query(`
      INSERT INTO trips (
        driver_id, driver_name, driver_phone,
        car_model, car_color, car_plate,
        date, time, departure, destination,
        total_seats, booked_seats, price_per_person,
        comment, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, 'active', NOW())
      RETURNING *
    `, [
      req.user.id, req.user.displayName, driverPhone,
      carModel, carColor, carPlate,
      date, time, departure, destination,
      totalSeats, pricePerPerson, comment || ''
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания поездки:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отменить поездку
app.put('/api/trips/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем, что поездка принадлежит текущему пользователю
    const tripCheck = await pool.query(
      'SELECT driver_id FROM trips WHERE id = $1', [id]
    );
    
    if (tripCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Поездка не найдена' });
    }
    
    if (tripCheck.rows[0].driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Нет прав для отмены' });
    }

    await pool.query(`UPDATE trips SET status = 'cancelled' WHERE id = $1`, [id]);
    // Также отменяем все бронирования
    await pool.query(`UPDATE bookings SET status = 'cancelled' WHERE trip_id = $1`, [id]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отмены поездки:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==================== Bookings ====================

// Забронировать место
app.post('/api/bookings', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { tripId, passengerPhone, seatsCount } = req.body;

    await client.query('BEGIN');

    // Проверяем наличие свободных мест (с блокировкой строки)
    const tripResult = await client.query(`
      SELECT * FROM trips WHERE id = $1 AND status = 'active' FOR UPDATE
    `, [tripId]);

    if (tripResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Поездка не найдена или отменена' });
    }

    const trip = tripResult.rows[0];
    const availableSeats = trip.total_seats - trip.booked_seats;

    if (seatsCount > availableSeats) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Недостаточно мест. Доступно: ${availableSeats}` 
      });
    }

    // Проверяем, не бронировал ли уже этот пользователь
    const existingBooking = await client.query(`
      SELECT * FROM bookings 
      WHERE trip_id = $1 AND passenger_id = $2 AND status = 'confirmed'
    `, [tripId, req.user.id]);

    if (existingBooking.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Вы уже забронировали место в этой поездке' });
    }

    // Создаём бронирование
    const bookingResult = await client.query(`
      INSERT INTO bookings (
        trip_id, passenger_id, passenger_name, passenger_phone,
        seats_count, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'confirmed', NOW())
      RETURNING *
    `, [tripId, req.user.id, req.user.displayName, passengerPhone, seatsCount]);

    // Обновляем количество занятых мест
    await client.query(`
      UPDATE trips SET booked_seats = booked_seats + $1 WHERE id = $2
    `, [seatsCount, tripId]);

    await client.query('COMMIT');
    res.status(201).json(bookingResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка бронирования:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// Получить мои бронирования
app.get('/api/bookings/my', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, 
        json_build_object(
          'id', t.id,
          'driverId', t.driver_id,
          'driverName', t.driver_name,
          'driverPhone', t.driver_phone,
          'carModel', t.car_model,
          'carColor', t.car_color,
          'carPlate', t.car_plate,
          'date', t.date,
          'time', t.time,
          'departure', t.departure,
          'destination', t.destination,
          'totalSeats', t.total_seats,
          'bookedSeats', t.booked_seats,
          'pricePerPerson', t.price_per_person,
          'status', t.status
        ) as trip
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      WHERE b.passenger_id = $1
      ORDER BY t.date DESC, t.time DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения бронирований:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отменить бронирование
app.put('/api/bookings/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Проверяем бронирование
    const bookingResult = await client.query(`
      SELECT * FROM bookings WHERE id = $1 FOR UPDATE
    `, [id]);

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    const booking = bookingResult.rows[0];

    if (booking.passenger_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Нет прав для отмены' });
    }

    if (booking.status !== 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Бронирование уже отменено' });
    }

    // Отменяем бронирование
    await client.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [id]);

    // Освобождаем места
    await client.query(`
      UPDATE trips SET booked_seats = GREATEST(0, booked_seats - $1) WHERE id = $2
    `, [booking.seats_count, booking.trip_id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка отмены бронирования:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// ==================== Запуск сервера ====================

app.listen(PORT, () => {
  console.log(`Carpool backend запущен на порту ${PORT}`);
  console.log(`PostgreSQL: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'carpool'}`);
});
