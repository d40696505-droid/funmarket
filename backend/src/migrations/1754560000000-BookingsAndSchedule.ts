import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingsAndSchedule1754560000000 implements MigrationInterface {
  name = 'BookingsAndSchedule1754560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sellerId" uuid NOT NULL,
        "dayOfWeek" smallint NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_schedules_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_schedules_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_schedules_sellerId" ON "schedules" ("sellerId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "schedule_exceptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sellerId" uuid NOT NULL,
        "date" date NOT NULL,
        "startTime" time,
        "endTime" time,
        "reason" character varying,
        CONSTRAINT "PK_schedule_exceptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_schedule_exceptions_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_exceptions_sellerId" ON "schedule_exceptions" ("sellerId")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM ('pending', 'confirmed', 'rejected', 'cancelled', 'paid', 'completed', 'disputed')`,
    );

    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "serviceId" uuid NOT NULL,
        "buyerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "bookingDate" date NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "locationAddress" character varying,
        "comment" character varying,
        "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending',
        "rejectionReason" character varying,
        "totalAmount" numeric(10,2),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bookings_service" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_bookings_buyer" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_bookings_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_serviceId" ON "bookings" ("serviceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_buyerId" ON "bookings" ("buyerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_sellerId" ON "bookings" ("sellerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_status" ON "bookings" ("status")`,
    );
    // Правка №5: страховка от гонок на уровне БД — один и тот же слот
    // продавца не может быть занят двумя активными (pending/confirmed) бронями.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_bookings_seller_slot_active"
      ON "bookings" ("sellerId", "bookingDate", "startTime")
      WHERE "status" IN ('pending', 'confirmed')
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM ('booking_created', 'booking_confirmed', 'booking_rejected', 'booking_cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "public"."notifications_type_enum" NOT NULL,
        "title" character varying NOT NULL,
        "body" character varying NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "data" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_isRead" ON "notifications" ("isRead")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "schedule_exceptions"`);
    await queryRunner.query(`DROP TABLE "schedules"`);
  }
}
