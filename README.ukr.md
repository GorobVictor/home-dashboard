# Home Dashboard

Монорепозиторій для домашньої панелі керування, яку можна розмістити на власному сервері. Наявний застосунок Next.js розташований у `apps/web`.

## Структура репозиторію

- `apps/web` — застосунок Next.js App Router та інтерфейс.
- `apps/worker` — процес воркера; тут можна додавати заплановані задачі.
- `packages/database` — місце для схеми Prisma, міграцій і репозиторіїв.
- `packages/integrations` — місце для спільних інтеграцій із пристроями та API.
- `docker` — Dockerfile сервісів і налаштування pgAdmin.

Воркер запускається без запланованих задач. Моделі бази даних та інтеграції ще не реалізовані.

## Розробка

```bash
npm install
npm run dev
```

Відкрийте [http://localhost:3000](http://localhost:3000). Запускайте `npm run typecheck` для перевірки типів обох застосунків і `npm run lint` для вебзастосунку з кореня репозиторію.

## Docker Compose

Скопіюйте `.env.example` у `.env` та задайте надійні різні значення для `POSTGRES_PASSWORD` і `PGADMIN_DEFAULT_PASSWORD`. Для пароля PostgreSQL використовуйте символи, безпечні для URL (літери, цифри, `_` або `-`), оскільки Compose також вставляє його у `DATABASE_URL`.

```bash
cp .env.example .env
docker compose up --build -d
```

Панель керування доступна за адресою [http://localhost:3000](http://localhost:3000), а pgAdmin — за [http://localhost:5050](http://localhost:5050). Увійдіть у pgAdmin за допомогою `PGADMIN_DEFAULT_EMAIL` і `PGADMIN_DEFAULT_PASSWORD` із `.env`. Підключення Home Dashboard PostgreSQL імпортується з `docker/pgadmin/servers.json`; пароль бази даних береться зі згенерованого файлу pgpass. PostgreSQL не має порту на хості, а обидва вебінтерфейси доступні лише через localhost.

Томи `postgres_data` і `pgadmin_data` зберігають дані між перезапусками. pgAdmin імпортує описи серверів під час першого створення свого тому з даними. Міграцій Prisma поки немає; коли їх буде додано, запускайте `prisma migrate deploy` як окремий крок розгортання.
