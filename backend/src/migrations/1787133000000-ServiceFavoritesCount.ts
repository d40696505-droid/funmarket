import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceFavoritesCount1787133000000 implements MigrationInterface {
  name = 'ServiceFavoritesCount1787133000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" ADD COLUMN "favoritesCount" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" DROP COLUMN "favoritesCount"`,
    );
  }
}
