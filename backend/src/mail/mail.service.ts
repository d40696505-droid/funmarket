import { Injectable, Logger } from '@nestjs/common';

/**
 * Заглушка почтового сервиса: логирует письма вместо отправки.
 * Заменить на реальную интеграцию (SendGrid/Mailgun) в Фазе 4/8,
 * интерфейс методов менять не потребуется.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  sendEmailVerification(email: string, token: string): Promise<void> {
    this.logger.log(`[stub] Verification email to ${email}: token=${token}`);
    return Promise.resolve();
  }

  sendPasswordReset(email: string, token: string): Promise<void> {
    this.logger.log(`[stub] Password reset email to ${email}: token=${token}`);
    return Promise.resolve();
  }

  send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[stub] Email to ${to}: ${subject} — ${body}`);
    return Promise.resolve();
  }
}
