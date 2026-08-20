import { MigrationInterface, QueryRunner } from 'typeorm';

// Снимает "1 слот = 1 бронь" на уровне БД (правка №5 из
// 1754560000000-BookingsAndSchedule.ts) — теперь слот может вмещать
// нескольких разных покупателей (см. Service.capacity /
// ScheduleException.capacity), это проверяется на уровне приложения под
// advisory-локом (bookings.service.ts create()). Новый уникальный индекс
// лишь не даёт ОДНОМУ покупателю задвоить активную бронь на тот же слот.
export class BookingSlotCapacity1787132000000 implements MigrationInterface {
  name = 'BookingSlotCapacity1787132000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_seller_slot_active"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_bookings_seller_slot_buyer_active"
      ON "bookings" ("sellerId", "bookingDate", "startTime", "buyerId")
      WHERE "status" IN ('pending', 'confirmed')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bookings_seller_slot_buyer_active"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_bookings_seller_slot_active"
      ON "bookings" ("sellerId", "bookingDate", "startTime")
      WHERE "status" IN ('pending', 'confirmed')
    `);
  }
}
