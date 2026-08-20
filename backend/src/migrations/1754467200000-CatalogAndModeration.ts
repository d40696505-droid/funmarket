import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogAndModeration1754467200000 implements MigrationInterface {
  name = 'CatalogAndModeration1754467200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isAdmin" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "icon" character varying,
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_categories_slug" ON "categories" ("slug")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."services_pricetype_enum" AS ENUM ('fixed', 'range', 'negotiable')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."services_priceunit_enum" AS ENUM ('hour', 'event', 'person')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."services_locationtype_enum" AS ENUM ('address', 'mobile', 'online')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."services_status_enum" AS ENUM ('draft', 'moderation', 'active', 'inactive')`,
    );

    await queryRunner.query(`
      CREATE TABLE "services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sellerId" uuid NOT NULL,
        "title" character varying(100) NOT NULL,
        "description" character varying(3000) NOT NULL,
        "categoryId" uuid NOT NULL,
        "priceMin" numeric(10,2),
        "priceMax" numeric(10,2),
        "priceType" "public"."services_pricetype_enum" NOT NULL,
        "priceUnit" "public"."services_priceunit_enum" NOT NULL,
        "durationMinutes" integer NOT NULL,
        "locationType" "public"."services_locationtype_enum" NOT NULL,
        "locationAddress" character varying,
        "locationPoint" geography(Point,4326),
        "travelRadiusKm" numeric(5,1),
        "tags" text[] NOT NULL DEFAULT '{}',
        "status" "public"."services_status_enum" NOT NULL DEFAULT 'draft',
        "moderationComment" character varying,
        "viewsCount" integer NOT NULL DEFAULT 0,
        "bookingsCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_services_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_services_seller" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_services_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_services_sellerId" ON "services" ("sellerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_services_categoryId" ON "services" ("categoryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_services_status" ON "services" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_services_location" ON "services" USING GIST ("locationPoint")`,
    );
    await queryRunner.query(`
      CREATE INDEX "IDX_services_search" ON "services"
      USING GIN (to_tsvector('russian', coalesce("title", '') || ' ' || coalesce("description", '')))
    `);

    await queryRunner.query(`
      CREATE TABLE "service_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "serviceId" uuid NOT NULL,
        "url" character varying NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_service_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_images_service" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_service_images_serviceId" ON "service_images" ("serviceId")`,
    );

    await queryRunner.query(`
      INSERT INTO "categories" ("name", "slug") VALUES
        ('Аниматоры и шоу-программы', 'animators'),
        ('Ведущие и тамада', 'hosts'),
        ('Музыканты и DJ', 'musicians-dj'),
        ('Фотографы и видеографы', 'photographers'),
        ('Квесты и игры', 'quests'),
        ('Мастер-классы', 'workshops'),
        ('Спортивные развлечения', 'sports'),
        ('Другое', 'other')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "service_images"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TYPE "public"."services_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."services_locationtype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."services_priceunit_enum"`);
    await queryRunner.query(`DROP TYPE "public"."services_pricetype_enum"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isAdmin"`);
  }
}
