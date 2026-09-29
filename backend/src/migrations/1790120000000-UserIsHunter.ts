import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIsHunter1790120000000 implements MigrationInterface {
  name = 'UserIsHunter1790120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isHunter" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isHunter"`);
  }
}
