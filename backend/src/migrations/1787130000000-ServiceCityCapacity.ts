import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceCityCapacity1787130000000 implements MigrationInterface {
  name = 'ServiceCityCapacity1787130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN "city" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN "capacity" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "capacity"`);
    await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "city"`);
  }
}
