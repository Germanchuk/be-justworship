#!/bin/bash

# Зупинити скрипт у разі помилки
set -e

# Переходимо в директорію скрипта, щоб точно знайти .env
cd "$(dirname "$0")"

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Помилка: Файл $ENV_FILE не знайдено!"
    exit 1
fi

# Функція для отримання значення з .env та видалення одинарних/подвійних лапок
get_env_var() {
    grep "^$1=" "$ENV_FILE" | cut -d '=' -f2- | sed -e "s/^'//" -e "s/'$//" -e "s/^\"//" -e "s/\"$//"
}

DATABASE_HOST=$(get_env_var "DATABASE_HOST")
DATABASE_NAME=$(get_env_var "DATABASE_NAME")
DATABASE_USERNAME=$(get_env_var "DATABASE_USERNAME")
DATABASE_PASSWORD=$(get_env_var "DATABASE_PASSWORD")

if [ -z "$DATABASE_HOST" ] || [ -z "$DATABASE_NAME" ] || [ -z "$DATABASE_USERNAME" ] || [ -z "$DATABASE_PASSWORD" ]; then
    echo "Помилка: Дані для підключення до бази відсутні у $ENV_FILE!"
    exit 1
fi

# Створюємо папку для бекапів, якщо її немає
mkdir -p backups

CURRENT_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="backups/${DATABASE_NAME}_${CURRENT_DATE}.sql"

echo "Починаємо створення бекапу для $DATABASE_NAME..."
echo "Хост: $DATABASE_HOST"
echo "Файл збереження: $BACKUP_FILE"

# Перевіряємо чи встановлено pg_dump
if ! command -v pg_dump &> /dev/null; then
    echo "Помилка: pg_dump не встановлено! Будь ласка, встановіть клієнтські утиліти PostgreSQL."
    exit 1
fi

# Neon вимагає SSL для з'єднання
export PGSSLMODE=require

# Виконуємо бекап (використовуємо звичайний текстовий формат SQL '-F p')
PGPASSWORD=$DATABASE_PASSWORD pg_dump \
    -h "$DATABASE_HOST" \
    -U "$DATABASE_USERNAME" \
    -d "$DATABASE_NAME" \
    -F p -f "$BACKUP_FILE"

echo "Бекап успішно завершено! Файл: $BACKUP_FILE"
