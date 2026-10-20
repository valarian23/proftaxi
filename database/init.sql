-- ============================================================
-- Скрипт инициализации базы данных для системы совместных поездок
-- СУБД: PostgreSQL 12+
-- ============================================================

-- Создание пользователя и базы данных (выполнять от имени postgres/superuser)
-- CREATE USER carpool_user WITH PASSWORD 'your_secure_password_here';
-- CREATE DATABASE carpool OWNER carpool_user;

-- Подключиться к базе carpool перед выполнением скрипта

-- ============================================================
-- Таблица: trips (поездки)
-- ============================================================
CREATE TABLE IF NOT EXISTS trips (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       VARCHAR(100) NOT NULL,          -- Доменное имя водителя
    driver_name     VARCHAR(255) NOT NULL,          -- ФИО водителя
    driver_phone    VARCHAR(30) NOT NULL,           -- Телефон водителя
    
    car_model       VARCHAR(100) NOT NULL,          -- Марка и модель авто
    car_color       VARCHAR(50) DEFAULT '',         -- Цвет авто
    car_plate       VARCHAR(20) DEFAULT '',         -- Госномер
    
    date            DATE NOT NULL,                  -- Дата поездки
    time            TIME NOT NULL,                  -- Время отправления
    departure       VARCHAR(500) NOT NULL,          -- Место отправления
    destination     VARCHAR(500) NOT NULL,          -- Место назначения
    
    total_seats     INTEGER NOT NULL DEFAULT 3,     -- Кол-во мест для пассажиров
    booked_seats    INTEGER NOT NULL DEFAULT 0,     -- Забронировано мест
    price_per_person INTEGER NOT NULL DEFAULT 0,    -- Стоимость на человека (руб.)
    
    comment         TEXT DEFAULT '',                -- Комментарий водителя
    status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active/cancelled/completed
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ограничения
    CONSTRAINT trips_total_seats_check CHECK (total_seats > 0 AND total_seats <= 7),
    CONSTRAINT trips_booked_seats_check CHECK (booked_seats >= 0),
    CONSTRAINT trips_status_check CHECK (status IN ('active', 'cancelled', 'completed'))
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_date_status ON trips(date, status);

-- ============================================================
-- Таблица: bookings (бронирования)
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    passenger_id    VARCHAR(100) NOT NULL,          -- Доменное имя пассажира
    passenger_name  VARCHAR(255) NOT NULL,          -- ФИО пассажира
    passenger_phone VARCHAR(30) NOT NULL,           -- Телефон пассажира
    
    seats_count     INTEGER NOT NULL DEFAULT 1,     -- Количество забронированных мест
    status          VARCHAR(20) NOT NULL DEFAULT 'confirmed',  -- confirmed/cancelled
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ограничения
    CONSTRAINT bookings_seats_check CHECK (seats_count > 0),
    CONSTRAINT bookings_status_check CHECK (status IN ('confirmed', 'cancelled')),
    -- Один пассажир — одно бронирование на поездку
    CONSTRAINT bookings_unique_passenger_trip UNIQUE (trip_id, passenger_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- ============================================================
-- Функция: автоматическое обновление booked_seats при отмене
-- ============================================================
CREATE OR REPLACE FUNCTION update_booked_seats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
        UPDATE trips 
        SET booked_seats = booked_seats + NEW.seats_count 
        WHERE id = NEW.trip_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
        UPDATE trips 
        SET booked_seats = GREATEST(0, booked_seats - OLD.seats_count) 
        WHERE id = OLD.trip_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления количества мест
DROP TRIGGER IF EXISTS trg_update_booked_seats ON bookings;
CREATE TRIGGER trg_update_booked_seats
    AFTER INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_booked_seats();

-- ============================================================
-- Права доступа
-- ============================================================
GRANT ALL PRIVILEGES ON TABLE trips TO carpool_user;
GRANT ALL PRIVILEGES ON TABLE bookings TO carpool_user;
GRANT USAGE ON SEQUENCE trips_id_seq TO carpool_user;
GRANT USAGE ON SEQUENCE bookings_id_seq TO carpool_user;

-- ============================================================
-- Примечания:
-- 1. UUID генерируется встроенной функцией gen_random_uuid() (PostgreSQL 13+)
--    Для PostgreSQL 12 и ниже используйте расширение pgcrypto:
--    CREATE EXTENSION IF NOT EXISTS pgcrypto;
--    и замените gen_random_uuid() на uuid_generate_v4()
--
-- 2. Очистка старых данных (рекомендуется настроить cron-задачу):
--    DELETE FROM trips WHERE date < CURRENT_DATE - INTERVAL '30 days' AND status != 'active';
--    DELETE FROM bookings WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
-- ============================================================
