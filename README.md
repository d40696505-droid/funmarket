# HobbyHub

C2C-маркетплейс развлекательных услуг (MVP). Монорепозиторий: `backend`
(NestJS) + `frontend` (Next.js).

См. `docs/tz-amendments.md` — правки и дополнения к исходному ТЗ.

## Локальная разработка

Требуется Docker и Docker Compose (конфигурация не проверена в песочнице —
проверить при первом запуске).

```bash
docker compose up -d        # Postgres (PostGIS) + Redis

cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
```

## Структура

```
backend/    NestJS API
frontend/   Next.js приложение
docs/       ТЗ, правки, документация
```
