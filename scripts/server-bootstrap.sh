#!/bin/sh
# HobbyHub — первичная настройка нового сервера (Ubuntu 24.04 LTS).
#
# Ставит инфраструктуру: Node.js 22, PostgreSQL 16 + PostGIS, MinIO (+ mc),
# Caddy, отдельного непривилегированного пользователя под приложение,
# базовый firewall. Создаёт БД и MinIO-бакет со свежими сгенерированными
# credentials (не копирует секреты со старого сервера).
#
# НЕ разворачивает код приложения, НЕ настраивает Caddyfile под конкретный
# домен и НЕ переносит данные — это отдельные шаги после того, как сервер
# поднят и DNS домена на него указывает (см. docs/release-plan.md, Фаза 1).
#
# Использование:
#   - Вставить как есть в поле "cloud-init" / "скрипт при первом запуске"
#     у хостинг-провайдера — выполнится автоматически при первой загрузке.
#   - Либо запустить вручную под root на уже поднятом сервере:
#       bash server-bootstrap.sh
#
# Идемпотентность: при повторном запуске не переустанавливает уже
# поставленное и не перегенерирует уже выданные credentials (см. маркер
# ниже) — безопасно перезапускать, если что-то прервалось на середине.
#
# Первая строка — #!/bin/sh, а не #!/bin/bash: некоторые хостинг-провайдеры
# принимают в поле "скрипт при первом запуске" только "#cloud-config" или
# "#!/bin/sh" в качестве первой строки. Ниже скрипт сам переисполняет себя
# под bash — дальше по коду используются bash-конструкции (set -o pipefail,
# [[ ]]), которых нет в POSIX sh/dash.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

MARKER=/root/.hobbyhub-bootstrap-done
REPORT=/root/hobbyhub-setup-report.txt

log() { echo "[bootstrap] $*"; }

if [ -f "$MARKER" ]; then
  log "Уже выполнялось ранее (см. $MARKER) — креды в $REPORT, повторно не генерирую."
  log "Если нужно settings с нуля — удалите $MARKER и перезапустите осознанно."
  exit 0
fi

: > "$REPORT"
report() { echo "$*" | tee -a "$REPORT" >/dev/null; }

export DEBIAN_FRONTEND=noninteractive

log "apt update/upgrade"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg unzip rsync ufw openssl

# ---------- Node.js 22 ----------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
  log "install Node.js 22.x (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
else
  log "Node.js уже $(node -v) — пропускаю"
fi

# ---------- PostgreSQL 16 + PostGIS ----------
log "install PostgreSQL 16 + PostGIS"
apt-get install -y postgresql-16 postgresql-16-postgis-3

DB_NAME=hobbyhub
DB_USER=hobbyhub
DB_PASSWORD=$(openssl rand -hex 16)

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

report "# --- PostgreSQL (backend/.env) ---"
report "DB_HOST=localhost"
report "DB_PORT=5432"
report "DB_USER=${DB_USER}"
report "DB_PASSWORD=${DB_PASSWORD}"
report "DB_NAME=${DB_NAME}"
report ""

# ---------- MinIO ----------
log "install MinIO"
id -u minio-user >/dev/null 2>&1 || useradd -r -s /sbin/nologin minio-user
mkdir -p /var/lib/minio-data
chown minio-user:minio-user /var/lib/minio-data

if [ ! -x /usr/local/bin/minio ]; then
  curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio -o /usr/local/bin/minio
  chmod +x /usr/local/bin/minio
fi
if [ ! -x /usr/local/bin/mc ]; then
  curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
  chmod +x /usr/local/bin/mc
fi

MINIO_ROOT_USER=$(openssl rand -hex 10)
MINIO_ROOT_PASSWORD=$(openssl rand -hex 20)
cat > /root/.minio-credentials <<EOF
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
EOF
chmod 600 /root/.minio-credentials

cat > /etc/systemd/system/minio.service <<'EOF'
[Unit]
Description=MinIO S3-compatible storage for HobbyHub
After=network.target

[Service]
Type=simple
User=minio-user
Group=minio-user
EnvironmentFile=/root/.minio-credentials
ExecStart=/usr/local/bin/minio server /var/lib/minio-data --address :9000 --console-address :9001
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now minio

log "жду поднятия MinIO"
for i in $(seq 1 30); do
  curl -sf http://localhost:9000/minio/health/live >/dev/null 2>&1 && break
  sleep 1
done

/usr/local/bin/mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
/usr/local/bin/mc mb -p local/hobbyhub >/dev/null
/usr/local/bin/mc anonymous set download local/hobbyhub >/dev/null

# Отдельная service-account пара для приложения — не root-креды MinIO.
S3_ACCESS_KEY=$(openssl rand -hex 10)
S3_SECRET_KEY=$(openssl rand -hex 20)
/usr/local/bin/mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null
/usr/local/bin/mc admin policy attach local readwrite --user "$S3_ACCESS_KEY" >/dev/null

report "# --- MinIO / S3 (backend/.env) ---"
report "S3_ENDPOINT=http://localhost:9000"
report "S3_REGION=us-east-1"
report "S3_BUCKET=hobbyhub"
report "S3_ACCESS_KEY_ID=${S3_ACCESS_KEY}"
report "S3_SECRET_ACCESS_KEY=${S3_SECRET_KEY}"
report "S3_FORCE_PATH_STYLE=true"
report "S3_PUBLIC_URL=http://localhost:9000/hobbyhub   # deploy.sh заменит на https://<домен>/hobbyhub — Caddy проксирует этот путь напрямую в MinIO"
report ""
report "# MinIO root-консоль (http://<ip>:9001) — только для администрирования:"
report "MINIO_ROOT_USER=${MINIO_ROOT_USER}"
report "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}"
report ""

# ---------- Caddy ----------
log "install Caddy"
apt-get install -y caddy
report "# Caddy установлен, Caddyfile под конкретный домен настраивается отдельно"
report ""

# ---------- отдельный непривилегированный пользователь под приложение ----------
if ! id -u hobbyhub >/dev/null 2>&1; then
  log "создаю пользователя 'hobbyhub' для backend/frontend (не root)"
  useradd -m -s /bin/bash hobbyhub
fi
report "# Системный пользователь для backend/frontend systemd-юнитов: hobbyhub"
report ""

# ---------- firewall ----------
log "настраиваю ufw"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

touch "$MARKER"
log "готово. Итоговые credentials — в ${REPORT} (root-only, chmod 600 рекомендуется)."
chmod 600 "$REPORT"
cat "$REPORT"
