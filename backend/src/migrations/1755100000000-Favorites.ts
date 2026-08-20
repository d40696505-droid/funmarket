import { MigrationInterface, QueryRunner } from 'typeorm';

export class Favorites1755100000000 implements MigrationInterface {
  name = 'Favorites1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "favorites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "serviceId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_favorites_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_favorites_service" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_favorites_user_service" ON "favorites" ("userId", "serviceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_favorites_userId" ON "favorites" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_favorites_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_favorites_user_service"`);
    await queryRunner.query(`DROP TABLE "favorites"`);
  }
}
