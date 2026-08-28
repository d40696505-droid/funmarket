# Шпаргалка: сервер HobbyHub

Все команды — под root, на новом сервере (Timeweb, `hobbyhub.ru`).

## Обновить сайт из GitHub (самое частое)

```bash
REPO_URL=git@github.com:d40696505-droid/funmarket.git bash ~/funmarket/scripts/deploy.sh
```

Что делает: подтягивает свежий код, ставит зависимости, собирает
backend/frontend, накатывает новые миграции БД, **перезапускает** сервисы.
Безопасно запускать повторно в любой момент.

## Проверить, что всё работает

```bash
systemctl status hobbyhub-backend hobbyhub-frontend caddy
curl -I https://hobbyhub.ru
```

## Перезапустить сервисы вручную (без обновления кода)

```bash
systemctl restart hobbyhub-backend hobbyhub-frontend
systemctl restart caddy
```

## Посмотреть логи (если что-то не работает)

```bash
journalctl -u hobbyhub-backend -n 100 --no-pager
journalctl -u hobbyhub-frontend -n 100 --no-pager
journalctl -u caddy -n 100 --no-pager
```

Добавьте `-f` в конце вместо `-n 100`, чтобы смотреть в реальном времени
(Ctrl+C — выйти).

## Где что лежит

| Что | Путь |
|---|---|
| Код приложения | `/home/hobbyhub/app` |
| Настройки backend (секреты, БД, S3) | `/home/hobbyhub/app/backend/.env` |
| Настройки frontend | `/home/hobbyhub/app/frontend/.env.local` |
| Caddy (домен, HTTPS) | `/etc/caddy/Caddyfile` |
| Все выданные пароли/ключи при первой настройке | `/root/hobbyhub-setup-report.txt` |

## Зайти в базу данных

```bash
cd /home/hobbyhub/app/backend
set -a && source .env && set +a
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
```
(`\q` — выйти из psql)

## Включить/выключить приём заказов («сайт в разработке»)

Включить заглушку (оформление брони недоступно, остальной сайт работает):
```bash
echo 'ORDERS_DISABLED=true' >> /home/hobbyhub/app/backend/.env
echo 'NEXT_PUBLIC_ORDERS_DISABLED=true' >> /home/hobbyhub/app/frontend/.env.local
REPO_URL=git@github.com:d40696505-droid/funmarket.git bash ~/funmarket/scripts/deploy.sh
```

Выключить (вернуть приём заказов) — удалить обе строки из `.env`/`.env.local`
(`nano /home/hobbyhub/app/backend/.env`, `nano /home/hobbyhub/app/frontend/.env.local`)
и повторить ту же команду деплоя.

## Откатиться на предыдущую версию (если обновление всё сломало)

```bash
cd /home/hobbyhub/app
git log --oneline -10        # найти нужный коммит
git checkout <хэш-коммита>
cd backend && npm ci && npm run build && cd ..
cd frontend && npm ci && npm run build && cd ..
systemctl restart hobbyhub-backend hobbyhub-frontend
```
Чтобы вернуться обратно на актуальную версию: `git checkout main` и повторить сборку.
