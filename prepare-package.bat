@echo off
REM ============================================================
REM Скрипт подготовки пакета для развёртывания на Windows 10
REM 
REM Запуск: prepare-package.bat
REM Результат: папка carpool-package/ с всеми файлами для переноса
REM ============================================================

echo.
echo ========================================
echo  Подготовка пакета для развёртывания
echo ========================================
echo.

REM Создаём папку пакета
if exist carpool-package rmdir /s /q carpool-package
mkdir carpool-package

REM 1. Копирование фронтенда (результат сборки)
echo [1/4] Копирование фронтенда...
if not exist dist (
    echo ОШИБКА: Папка dist не найдена. Сначала выполните: npm run build
    pause
    exit /b 1
)
xcopy /E /I /Q dist carpool-package\dist
echo    OK: dist/ скопирован

REM 2. Копирование бэкенда с node_modules
echo [2/4] Копирование бэкенда...
if not exist backend\node_modules (
    echo Устанавливаем зависимости бэкенда...
    cd backend
    call npm install
    cd ..
)
xcopy /E /I /Q backend\server.js carpool-package\backend\
xcopy /E /I /Q backend\package.json carpool-package\backend\
xcopy /E /I /Q backend\.env.example carpool-package\backend\
xcopy /E /I /Q backend\node_modules carpool-package\backend\node_modules
echo    OK: backend/ скопирован

REM 3. Копирование скриптов БД и развёртывания
echo [3/4] Копирование скриптов...
xcopy /E /I /Q database carpool-package\database
xcopy /E /I /Q deploy carpool-package\deploy

REM 4. Копирование документации
echo [4/4] Копирование документации...
copy README.md carpool-package\README.md >nul

echo.
echo ========================================
echo  Пакет готов!
echo ========================================
echo.
echo Папка: carpool-package\
echo.
echo Содержимое:
echo   dist\          - фронтенд (готов к раздаче Nginx)
echo   backend\       - бэкенд с зависимостями
echo   database\      - SQL-скрипт инициализации БД
echo   deploy\        - скрипты установки и конфиг Nginx
echo   README.md      - инструкция по развёртыванию
echo.
echo СЛЕДУЮЩИЕ ШАГИ:
echo 1. Скачайте Node.js для Linux:
echo    https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz
echo    Положите файл в carpool-package\
echo.
echo 2. Запакуйте папку carpool-package в архив
echo.
echo 3. Перенесите архив на сервер Astra Linux
echo.
echo 4. На сервере выполните:
echo    sudo bash deploy/install.sh
echo.
pause
