import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIsSupport1787135000000 implements MigrationInterface {
  name = 'UserIsSupport1787135000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "isSupport" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isSupport"`);
  }
}
