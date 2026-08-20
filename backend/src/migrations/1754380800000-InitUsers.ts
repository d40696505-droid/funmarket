import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitUsers1754380800000 implements MigrationInterface {
  name = 'InitUsers1754380800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM ('buyer', 'seller', 'both')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "firstName" character varying,
        "lastName" character varying,
        "avatarUrl" character varying,
        "phone" character varying,
        "role" "public"."users_role_enum" NOT NULL,
        "brandName" character varying,
        "bio" character varying,
        "city" character varying,
        "location" geometry(Point,4326),
        "rating" numeric(3,2) NOT NULL DEFAULT '0',
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "isPhoneVerified" boolean NOT NULL DEFAULT false,
        "emailVerificationTokenHash" character varying,
        "emailVerificationTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
        "passwordResetTokenHash" character varying,
        "passwordResetTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
        "refreshTokenHash" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
