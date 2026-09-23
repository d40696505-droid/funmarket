import { MigrationInterface, QueryRunner } from 'typeorm';

// booking_reschedule_* добавлялись в TS-enum раньше в этой же сессии, но
// миграция для реального Postgres-enum потерялась — INSERT с этими
// значениями упал бы с ошибкой "invalid input value for enum". Добавляем
// их сейчас вместе с message_received (уведомления о новых сообщениях).
export class NotificationTypesExpand1790090000000
  implements MigrationInterface
{
  name = 'NotificationTypesExpand1790090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'booking_reschedule_proposed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'booking_rescheduled'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'booking_reschedule_rejected'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'message_received'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL не поддерживает удаление значения enum без пересоздания
    // типа — как и в PaymentsEscrow, откат этой части сознательно no-op.
  }
}
