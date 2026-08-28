import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserReviewsCount1787134000000 implements MigrationInterface {
  name = 'UserReviewsCount1787134000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "reviewsCount" integer NOT NULL DEFAULT 0`,
    );
    // Бэкфилл для продавцов, у которых уже есть отзывы.
    await queryRunner.query(`
      UPDATE "users" u
      SET "reviewsCount" = sub.count
      FROM (
        SELECT "targetId", COUNT(*) AS count
        FROM "reviews"
        GROUP BY "targetId"
      ) sub
      WHERE u.id = sub."targetId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "reviewsCount"`);
  }
}
