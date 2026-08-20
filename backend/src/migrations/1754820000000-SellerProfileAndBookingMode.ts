import { MigrationInterface, QueryRunner } from 'typeorm';

export class SellerProfileAndBookingMode1754820000000 implements MigrationInterface {
  name = 'SellerProfileAndBookingMode1754820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "users_sellertype_enum" AS ENUM('private', 'professional')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "sellerType" "users_sellertype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "skills" text[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "interests" text[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "interestsOther" character varying`,
    );

    await queryRunner.query(
      `CREATE TYPE "services_bookingmode_enum" AS ENUM('slots', 'request')`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD "bookingMode" "services_bookingmode_enum" NOT NULL DEFAULT 'slots'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "bookingMode"`);
    await queryRunner.query(`DROP TYPE "services_bookingmode_enum"`);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "interestsOther"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "interests"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "skills"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sellerType"`);
    await queryRunner.query(`DROP TYPE "users_sellertype_enum"`);
  }
}
