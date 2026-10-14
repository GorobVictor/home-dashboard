# Home Dashboard

Монорепозиторій для домашньої панелі керування, яку можна розмістити на власному сервері. Наявний застосунок Next.js розташований у `apps/web`.

## Структура репозиторію

- `apps/web` — застосунок Next.js App Router та інтерфейс.
- `apps/worker` — процес воркера; тут можна додавати заплановані задачі.
- `packages/database` — схема Prisma, міграції, клієнт і репозиторій користувачів.
- `packages/integrations` — місце для спільних інтеграцій із пристроями та API.
- `docker` — Dockerfile сервісів і налаштування pgAdmin.

Воркер запускається без запланованих задач. Інтеграції з пристроями та зовнішніми API ще не реалізовані.

## Розробка

```bash
npm install
npm run dev
```

Відкрийте [http://localhost:3000](http://localhost:3000). Запускайте `npm run typecheck` для перевірки типів обох застосунків і `npm run lint` для вебзастосунку з кореня репозиторію.

## Docker Compose

Скопіюйте `.env.example` у `.env`. Задайте надійні різні значення для `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD` і `AUTH_JWT_SECRET`. Згенеруйте секрет JWT командою `openssl rand -base64 48`. Для пароля PostgreSQL використовуйте символи, безпечні для URL (літери, цифри, `_` або `-`), оскільки Compose також вставляє його у `DATABASE_URL`. Для першого користувача задайте `INITIAL_USER_FIRST_NAME`, `INITIAL_USER_LAST_NAME`, `INITIAL_USER_LOGIN` і `INITIAL_USER_PASSWORD`. Пароль має містити 12–128 символів, а логін — 3–50 малих латинських літер, цифр, `.`, `_` або `-`.

```bash
cp .env.example .env
docker compose build web worker
docker compose run --rm setup
docker compose up -d
```

Команда `setup` окремим кроком застосовує збережені міграції та створює першого користувача. Вона не скидає пароль наявного користувача. Щоб додати ще одного користувача, задайте інші значення `INITIAL_USER_*` і знову виконайте `docker compose run --rm setup`. Після використання приберіть `INITIAL_USER_PASSWORD` із `.env`. Для наступних змін схеми без створення користувача запускайте `docker compose run --rm migrate`. Усередині контейнера з налаштованим `DATABASE_URL` міграцію виконує команда `npm run db:migrate`.

Панель керування доступна за адресою [http://localhost:3000](http://localhost:3000), а pgAdmin — за [http://localhost:5050](http://localhost:5050). Увійдіть у pgAdmin за допомогою `PGADMIN_DEFAULT_EMAIL` і `PGADMIN_DEFAULT_PASSWORD` із `.env`. Підключення Home Dashboard PostgreSQL імпортується з `docker/pgadmin/servers.json`; пароль бази даних береться зі згенерованого файлу pgpass. PostgreSQL не має порту на хості, а обидва вебінтерфейси доступні лише через localhost.

Користувачі панелі входять за попередньо створеними логіном і паролем. Публічного маршруту реєстрації немає. Паролі зберігаються як хеші scrypt, а восьмигодинна сесія JWT — у cookie HttpOnly. Томи `postgres_data` і `pgadmin_data` зберігають дані між перезапусками. pgAdmin імпортує описи серверів під час першого створення свого тому з даними.
