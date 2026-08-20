import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsEscrow1755000000000 implements MigrationInterface {
  name = 'PaymentsEscrow1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Партиционный индекс ссылается на колонку "status" в своём предикате —
    // Postgres не даёт менять тип колонки, пока индекс на ней завязан на старый
    // тип, поэтому сперва дропаем индекс, потом меняем тип, потом создаём заново.
    await queryRunner.query(`DROP INDEX "IDX_bookings_seller_slot_active"`);

    // ALTER TYPE ... ADD VALUE не может использоваться в той же транзакции,
    // в которой значение добавлено (TypeORM гоняет миграции одного запуска
    // в одной транзакции) — а новое значение 'awaiting_payment' сразу нужно
    // в предикате партиционного индекса ниже. Поэтому пересоздаём тип целиком
    // вместо ADD VALUE.
    await queryRunner.query(
      `ALTER TYPE "public"."bookings_status_enum" RENAME TO "bookings_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM ('pending', 'confirmed', 'awaiting_payment', 'rejected', 'cancelled', 'paid', 'completed', 'disputed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "public"."bookings_status_enum" USING "status"::text::"public"."bookings_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum_old"`);

    // Правка №5 (см. 1754560000000-BookingsAndSchedule.ts) считала слот занятым
    // при pending/confirmed. Confirm() теперь сразу переводит в awaiting_payment,
    // минуя confirmed — без расширения предиката слот освободился бы для повторного
    // бронирования, пока первый покупатель ещё не оплатил.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_bookings_seller_slot_active"
      ON "bookings" ("sellerId", "bookingDate", "startTime")
      WHERE "status" IN ('pending', 'confirmed', 'awaiting_payment')
    `);

    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "paymentDeadline" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "escrowReleaseAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD "isSellerVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "sellerVerifiedAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM ('pending', 'paid', 'released', 'refunded', 'failed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bookingId" uuid NOT NULL,
        "provider" character varying NOT NULL DEFAULT 'mock_yookassa',
        "providerTransactionId" character varying NOT NULL,
        "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'pending',
        "amount" numeric(10,2) NOT NULL,
        "commissionAmount" numeric(10,2) NOT NULL,
        "sellerPayoutAmount" numeric(10,2) NOT NULL,
        "commissionRateSnapshot" numeric(5,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'RUB',
        "providerPayload" jsonb,
        "receiptStatus" character varying,
        "receiptUrl" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "paidAt" TIMESTAMP WITH TIME ZONE,
        "releasedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_transactions_providerTransactionId" ON "transactions" ("providerTransactionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_bookingId" ON "transactions" ("bookingId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")`,
    );

    // Безопасно как ADD VALUE — новые значения нигде не используются в этой же миграции.
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'payment_received'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'payment_expired'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'payout_released'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'booking_disputed'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres не поддерживает удаление отдельных значений enum напрямую —
    // откат notifications_type_enum до состояния без payment_*/booking_disputed
    // потребовал бы пересоздания типа (как для bookings_status_enum выше) и
    // предварительного удаления всех notifications с этими типами. Намеренно
    // не делаем это в down() — откат этой миграции ожидается только на dev/test
    // окружениях до продакшен-данных с такими уведомлениями.

    await queryRunner.query(`DROP INDEX "IDX_transactions_status"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_bookingId"`);
    await queryRunner.query(
      `DROP INDEX "IDX_transactions_providerTransactionId"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "sellerVerifiedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isSellerVerified"`,
    );

    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "escrowReleaseAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN "paymentDeadline"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_bookings_seller_slot_active"`);

    await queryRunner.query(
      `ALTER TYPE "public"."bookings_status_enum" RENAME TO "bookings_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM ('pending', 'confirmed', 'rejected', 'cancelled', 'paid', 'completed', 'disputed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "public"."bookings_status_enum" USING "status"::text::"public"."bookings_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum_old"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_bookings_seller_slot_active"
      ON "bookings" ("sellerId", "bookingDate", "startTime")
      WHERE "status" IN ('pending', 'confirmed')
    `);
  }
}
