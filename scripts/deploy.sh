#!/bin/sh
# HobbyHub — деплой кода приложения на уже подготовленный сервер.
#
# Предполагает, что server-bootstrap.sh уже отработал на этом сервере
# (есть пользователь hobbyhub, PostgreSQL+PostGIS, MinIO, Caddy, отчёт
# /root/hobbyhub-setup-report.txt с credentials). Этот скрипт клонирует
# репозиторий, собирает backend/frontend, накатывает миграции, создаёт
# systemd-юниты и добавляет домен в Caddyfile.
#
# Запуск (на сервере, под root) — репозиторий на GitHub решили не
# переименовывать, остался funmarket, хотя сам продукт называется HobbyHub:
#   REPO_URL=git@github.com:d40696505-droid/funmarket.git bash deploy.sh
#
# Опционально можно передать ключи Яндекса, иначе останутся плейсхолдеры
# в .env (карта/геокодер не заработают, пока не проставите вручную):
#   YANDEX_GEOCODER_API_KEY=... YANDEX_MAPS_API_KEY=... REPO_URL=... bash deploy.sh
#
# Первая строка — #!/bin/sh, не #!/bin/bash (см. пояснение в
# server-bootstrap.sh) — скрипт сам переисполняет себя под bash ниже.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

REPO_URL="${REPO_URL:?Укажите REPO_URL, например: REPO_URL=git@github.com:ВАШ_АККАУНТ/hobbyhub.git bash deploy.sh}"
DOMAIN="${DOMAIN:-hobbyhub.ru}"
WWW_DOMAIN="${WWW_DOMAIN:-www.hobbyhub.ru}"
APP_USER="${APP_USER:-hobbyhub}"
APP_DIR="${APP_DIR:-/home/hobbyhub/app}"
BOOTSTRAP_REPORT="${BOOTSTRAP_REPORT:-/root/hobbyhub-setup-report.txt}"
DEPLOY_KEY=/root/.ssh/hobbyhub_deploy_key
YANDEX_GEOCODER_API_KEY="${YANDEX_GEOCODER_API_KEY:-}"
YANDEX_MAPS_API_KEY="${YANDEX_MAPS_API_KEY:-}"

log() { echo "[deploy] $*"; }

# ---------- 0. Пречек ----------
if [ ! -f "$BOOTSTRAP_REPORT" ]; then
  echo "Не найден $BOOTSTRAP_REPORT — похоже, server-bootstrap.sh ещё не запускался на этом сервере. Сначала он." >&2
  exit 1
fi
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  echo "Пользователь $APP_USER не найден — запустите сначала server-bootstrap.sh." >&2
  exit 1
fi

# ---------- 1. Клонирование репозитория по SSH deploy key ----------
if [ ! -f "$DEPLOY_KEY" ]; then
  log "генерирую SSH-ключ для доступа к репозиторию"
  ssh-keygen -t ed25519 -N "" -f "$DEPLOY_KEY" -C "hobbyhub-deploy" >/dev/null
fi
export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new"

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  log "клонирую $REPO_URL в $APP_DIR"
  if ! git clone "$REPO_URL" "$APP_DIR" 2>/tmp/git-clone.err; then
    echo
    echo "Не удалось клонировать репозиторий — скорее всего, ключ ниже ещё не добавлен в GitHub."
    echo "Добавьте его: репозиторий → Settings → Deploy keys → Add deploy key (доступ на чтение достаточно), затем перезапустите этот скрипт:"
    echo
    cat "${DEPLOY_KEY}.pub"
    echo
    cat /tmp/git-clone.err >&2
    exit 1
  fi
else
  log "репозиторий уже склонирован, обновляю (git pull)"
  git -C "$APP_DIR" pull --ff-only
fi

# ---------- 2. backend/.env и frontend/.env.local ----------
BACKEND_ENV="$APP_DIR/backend/.env"
if [ ! -f "$BACKEND_ENV" ]; then
  log "создаю backend/.env из отчёта bootstrap-скрипта"
  DB_USER=$(sed -n 's/^DB_USER=//p' "$BOOTSTRAP_REPORT" | head -1)
  DB_PASSWORD=$(sed -n 's/^DB_PASSWORD=//p' "$BOOTSTRAP_REPORT" | head -1)
  DB_NAME=$(sed -n 's/^DB_NAME=//p' "$BOOTSTRAP_REPORT" | head -1)
  S3_ACCESS_KEY_ID=$(sed -n 's/^S3_ACCESS_KEY_ID=//p' "$BOOTSTRAP_REPORT" | head -1)
  S3_SECRET_ACCESS_KEY=$(sed -n 's/^S3_SECRET_ACCESS_KEY=//p' "$BOOTSTRAP_REPORT" | head -1)

  cat > "$BACKEND_ENV" <<EOF
PORT=3000
CORS_ORIGIN=https://${DOMAIN},https://${WWW_DOMAIN}

DB_HOST=localhost
DB_PORT=5432
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_TTL=30d

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=hobbyhub
S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=https://${DOMAIN}/hobbyhub

YANDEX_GEOCODER_API_KEY=${YANDEX_GEOCODER_API_KEY:-REPLACE_ME}

FRONTEND_URL=https://${DOMAIN}
PAYMENT_WEBHOOK_SECRET=$(openssl rand -hex 32)
PAYMENT_COMMISSION_PERCENT=10
PAYMENT_ESCROW_RELEASE_HOURS=48
PAYMENT_TIMEOUT_MINUTES=30
EOF
  chmod 600 "$BACKEND_ENV"
else
  log "backend/.env уже существует — не трогаю"
fi

FRONTEND_ENV="$APP_DIR/frontend/.env.local"
if [ ! -f "$FRONTEND_ENV" ]; then
  log "создаю frontend/.env.local"
  cat > "$FRONTEND_ENV" <<EOF
# Пусто и намеренно: браузер шлёт /api/* на тот же домен, next.config.ts
# сам проксирует их на localhost:3000 (см. rewrites()) — без этого ломается
# на разных доменах CORS/куки. Для запросов из Server Components — ниже
# отдельный INTERNAL_API_URL, идущий напрямую в обход Caddy/TLS.
NEXT_PUBLIC_API_URL=
INTERNAL_API_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=https://${DOMAIN}
NEXT_PUBLIC_YANDEX_MAPS_API_KEY=${YANDEX_MAPS_API_KEY:-REPLACE_ME}
EOF
else
  log "frontend/.env.local уже существует — не трогаю"
fi

if [ -z "$YANDEX_GEOCODER_API_KEY" ] || [ -z "$YANDEX_MAPS_API_KEY" ]; then
  log "ВНИМАНИЕ: ключи Яндекса не заданы — карта/геокодер не заработают, пока не проставите YANDEX_GEOCODER_API_KEY (backend/.env) и NEXT_PUBLIC_YANDEX_MAPS_API_KEY (frontend/.env.local) вручную"
fi

# ---------- 3. Установка зависимостей, сборка, миграции ----------
log "backend: npm ci && build"
cd "$APP_DIR/backend"
npm ci
npm run build

log "backend: миграции БД"
npm run migration:run

log "frontend: npm ci && build"
cd "$APP_DIR/frontend"
npm ci
npm run build

# ---------- 4. Права на файлы проекта ----------
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---------- 5. systemd-юниты ----------
log "создаю systemd-юниты"
cat > /etc/systemd/system/hobbyhub-backend.service <<EOF
[Unit]
Description=HobbyHub backend (NestJS)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3
User=${APP_USER}

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/hobbyhub-frontend.service <<EOF
[Unit]
Description=HobbyHub frontend (Next.js production)
After=network.target hobbyhub-backend.service
Wants=hobbyhub-backend.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/frontend
ExecStart=${APP_DIR}/frontend/node_modules/.bin/next start -p 3002
Restart=always
RestartSec=3
User=${APP_USER}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now hobbyhub-backend hobbyhub-frontend

# ---------- 6. Caddyfile ----------
CADDYFILE=/etc/caddy/Caddyfile
if [ ! -f "$CADDYFILE" ] || ! grep -q "$DOMAIN" "$CADDYFILE"; then
  log "добавляю $DOMAIN в Caddyfile"
  cat >> "$CADDYFILE" <<EOF

${DOMAIN}, ${WWW_DOMAIN} {
    # WebSocket-чат — напрямую в backend, в обход next.config.ts rewrites
    # (rewrites проксируют только /api/*, не /ws/*).
    handle /ws/* {
        reverse_proxy localhost:3000
    }
    # Публичные файлы MinIO: бакет называется hobbyhub, поэтому путь
    # /hobbyhub/* проксируется как есть, без переписывания.
    handle /hobbyhub/* {
        reverse_proxy localhost:9000
    }
    handle {
        reverse_proxy localhost:3002
    }
}
EOF
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
else
  log "Caddyfile уже содержит $DOMAIN — не трогаю"
fi

log "готово."
log "  systemctl status hobbyhub-backend"
log "  systemctl status hobbyhub-frontend"
log "  systemctl status caddy"
log "  curl -I https://${DOMAIN}"
