import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleExceptionTypeCapacity1787131000000
  implements MigrationInterface
{
  name = 'ScheduleExceptionTypeCapacity1787131000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."schedule_exceptions_type_enum" AS ENUM ('block', 'available')`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_exceptions" ADD COLUMN "type" "public"."schedule_exceptions_type_enum" NOT NULL DEFAULT 'block'`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_exceptions" ADD COLUMN "capacity" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_exceptions" DROP COLUMN "capacity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_exceptions" DROP COLUMN "type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."schedule_exceptions_type_enum"`,
    );
  }
}
