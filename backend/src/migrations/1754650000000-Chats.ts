import { MigrationInterface, QueryRunner } from 'typeorm';

export class Chats1754650000000 implements MigrationInterface {
  name = 'Chats1754650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chats" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "participant1Id" uuid NOT NULL,
        "participant2Id" uuid NOT NULL,
        "bookingId" uuid,
        "lastMessageAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chats_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chats_participant1" FOREIGN KEY ("participant1Id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chats_participant2" FOREIGN KEY ("participant2Id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chats_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_chats_participant1Id" ON "chats" ("participant1Id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chats_participant2Id" ON "chats" ("participant2Id")`,
    );
    // Не больше одного чата на пару участников, независимо от порядка id.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_chats_participants_pair"
      ON "chats" (LEAST("participant1Id", "participant2Id"), GREATEST("participant1Id", "participant2Id"))
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "chatId" uuid NOT NULL,
        "senderId" uuid,
        "isSystem" boolean NOT NULL DEFAULT false,
        "text" character varying(2000) NOT NULL,
        "imageUrls" text[] NOT NULL DEFAULT '{}',
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_chat" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_chatId" ON "messages" ("chatId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_isRead" ON "messages" ("isRead")`,
    );

    await queryRunner.query(`
      CREATE TABLE "message_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "reporterId" uuid NOT NULL,
        "reason" character varying(500) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_reports_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_message_reports_message" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_message_reports_reporter" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_message_reports_messageId" ON "message_reports" ("messageId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "message_reports"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "chats"`);
  }
}
