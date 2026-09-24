import { MigrationInterface, QueryRunner } from 'typeorm';

export class Follows1790110000000 implements MigrationInterface {
  name = 'Follows1790110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "followerId" uuid NOT NULL,
        "sellerId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follows_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_follows_follower" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follows_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_follows_follower_seller" ON "follows" ("followerId", "sellerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_follows_sellerId" ON "follows" ("sellerId")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'seller_new_service'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "follows"`);
  }
}
