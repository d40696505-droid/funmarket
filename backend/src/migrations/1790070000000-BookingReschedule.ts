import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookingReschedule1790070000000 implements MigrationInterface {
  name = 'BookingReschedule1790070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN "proposedDate" date,
        ADD COLUMN "proposedStartTime" time,
        ADD COLUMN "proposedEndTime" time
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP COLUMN "proposedDate",
        DROP COLUMN "proposedStartTime",
        DROP COLUMN "proposedEndTime"
    `);
  }
}
