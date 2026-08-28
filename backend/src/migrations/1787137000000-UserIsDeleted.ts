import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIsDeleted1787137000000 implements MigrationInterface {
  name = 'UserIsDeleted1787137000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "isDeleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isDeleted"`);
  }
}
