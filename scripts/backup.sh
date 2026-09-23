#!/bin/sh
# HobbyHub — ежедневный бэкап БД и файлового хранилища (MinIO).
#
# Что делает: pg_dump в сжатом custom-формате + tar.gz снапшот данных MinIO,
# оба с ротацией (хранится последние KEEP_DAYS дней). Всё локально на этом
# же сервере — защищает от порчи/случайного удаления данных, НЕ защищает от
# полной потери сервера (диск, хостинг). Для этого нужна отдельная выгрузка
# копий за пределы сервера — см. TODO в конце файла.
#
# Запуск: через systemd-таймер (см. scripts/backup.service/.timer) или
# вручную: bash scripts/backup.sh
#
# Первая строка — #!/bin/sh по тем же причинам, что и в остальных скриптах
# этого проекта (см. server-bootstrap.sh) — сам переисполняет себя под bash.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

APP_DIR="${APP_DIR:-/home/hobbyhub/app}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date +%Y-%m-%d-%H%M%S)

log() { echo "[backup] $*"; }

ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Не найден $ENV_FILE" >&2
  exit 1
fi
# Не source'им весь .env целиком — там есть значения со спецсимволами
# (пароль почты), которые ломают парсинг в sh/bash. Достаём точечно.
get_env() { sed -n "s/^$1=//p" "$ENV_FILE" | head -1; }
DB_HOST=$(get_env DB_HOST)
DB_PORT=$(get_env DB_PORT)
DB_USER=$(get_env DB_USER)
DB_PASSWORD=$(get_env DB_PASSWORD)
DB_NAME=$(get_env DB_NAME)

mkdir -p "$BACKUP_ROOT/db" "$BACKUP_ROOT/minio"

# ---------- PostgreSQL ----------
DB_DUMP="$BACKUP_ROOT/db/${DB_NAME}-${STAMP}.dump"
log "дамп БД -> $DB_DUMP"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
  -d "$DB_NAME" -Fc -f "$DB_DUMP"
log "готово, размер: $(du -h "$DB_DUMP" | cut -f1)"

# ---------- MinIO (файлы: фото услуг, аватары, фото отзывов) ----------
MINIO_DATA_DIR="${MINIO_DATA_DIR:-/var/lib/minio-data}"
if [ -d "$MINIO_DATA_DIR" ]; then
  MINIO_DUMP="$BACKUP_ROOT/minio/minio-${STAMP}.tar.gz"
  log "снапшот MinIO -> $MINIO_DUMP"
  tar -czf "$MINIO_DUMP" -C "$(dirname "$MINIO_DATA_DIR")" "$(basename "$MINIO_DATA_DIR")"
  log "готово, размер: $(du -h "$MINIO_DUMP" | cut -f1)"
else
  log "MinIO data dir не найден ($MINIO_DATA_DIR) — пропускаю"
fi

# ---------- Ротация ----------
log "чищу бэкапы старше ${KEEP_DAYS} дней"
find "$BACKUP_ROOT/db" -name '*.dump' -mtime "+${KEEP_DAYS}" -delete
find "$BACKUP_ROOT/minio" -name '*.tar.gz' -mtime "+${KEEP_DAYS}" -delete

log "готово. Текущие бэкапы:"
du -sh "$BACKUP_ROOT"/db/* "$BACKUP_ROOT"/minio/* 2>/dev/null | tail -10

# TODO: копии за пределы сервера. Варианты — периодически скачивать
# scp/rsync'ом на свою машину, или настроить выгрузку на внешнее S3-
# совместимое хранилище (Yandex Object Storage и т.п.), которого сейчас
# в проекте нет.
