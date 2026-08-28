import { Injectable, Logger } from '@nestjs/common';

/**
 * Заглушка почтового сервиса: логирует письма вместо отправки.
 * Заменить на реальную интеграцию (SendGrid/Mailgun) в Фазе 4/8,
 * интерфейс методов менять не потребуется.
 *
 * Токены verification/reset — это готовый доступ к смене чужого пароля или
 * подтверждению чужого email, поэтому в проде их лог не пишем (в БД хранится
 * только хэш, восстановить их иначе неоткуда). В dev/staging без почтового
 * провайдера токен всё ещё нужен для ручного тестирования — там оставляем.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  sendEmailVerification(email: string, token: string): Promise<void> {
    this.logger.log(
      this.isProduction
        ? `[stub] Verification email to ${email} (not sent — no mail provider configured)`
        : `[stub] Verification email to ${email}: token=${token}`,
    );
    return Promise.resolve();
  }

  sendPasswordReset(email: string, token: string): Promise<void> {
    this.logger.log(
      this.isProduction
        ? `[stub] Password reset email to ${email} (not sent — no mail provider configured)`
        : `[stub] Password reset email to ${email}: token=${token}`,
    );
    return Promise.resolve();
  }

  send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[stub] Email to ${to}: ${subject} — ${body}`);
    return Promise.resolve();
  }
}
