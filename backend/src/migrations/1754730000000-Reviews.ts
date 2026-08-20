import { MigrationInterface, QueryRunner } from 'typeorm';

export class Reviews1754730000000 implements MigrationInterface {
  name = 'Reviews1754730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bookingId" uuid NOT NULL,
        "reviewerId" uuid NOT NULL,
        "targetId" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "text" character varying(1000) NOT NULL,
        "photoUrls" text[] NOT NULL DEFAULT '{}',
        "sellerReply" character varying(1000),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reviews_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_reviewer" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_target" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_reviews_bookingId" ON "reviews" ("bookingId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_targetId" ON "reviews" ("targetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reviews"`);
  }
}
