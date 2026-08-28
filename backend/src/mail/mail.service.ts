import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Отправка писем через SMTP (nodemailer). Если SMTP_* не заданы в
 * окружении (например, в локальной разработке) — деградирует до
 * логирования, как раньше, чтобы не требовать реальных credentials для
 * работы с проектом локально.
 *
 * Токены verification/reset — это готовый доступ к смене чужого пароля
 * или подтверждению чужого email, поэтому в проде их лог не пишем (в БД
 * хранится только хэш, восстановить их иначе неоткуда). В dev/staging
 * без SMTP токен всё ещё нужен для ручного тестирования — там оставляем.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3002',
    );

    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const password = this.configService.get<string>('SMTP_PASSWORD');
    this.from = this.configService.get<string>('MAIL_FROM', user ?? '');

    if (host && port && user && password) {
      this.transporter = createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password },
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP не настроен (SMTP_HOST/PORT/USER/PASSWORD) — письма будут только логироваться',
      );
    }
  }

  private async deliver(
    to: string,
    subject: string,
    html: string,
    fallbackLogMessage: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        this.isProduction
          ? `[stub] Email to ${to} (not sent — SMTP not configured)`
          : `[stub] ${fallbackLogMessage}`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }

  sendEmailVerification(email: string, token: string): Promise<void> {
    const url = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    return this.deliver(
      email,
      'Подтвердите email — HobbyHub',
      `<p>Подтвердите ваш email на HobbyHub, перейдя по ссылке:</p><p><a href="${url}">${url}</a></p><p>Если вы не регистрировались на HobbyHub, просто проигнорируйте это письмо.</p>`,
      `Verification email to ${email}: token=${token}`,
    );
  }

  sendPasswordReset(email: string, token: string): Promise<void> {
    const url = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    return this.deliver(
      email,
      'Восстановление пароля — HobbyHub',
      `<p>Для сброса пароля на HobbyHub перейдите по ссылке (действует ограниченное время):</p><p><a href="${url}">${url}</a></p><p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>`,
      `Password reset email to ${email}: token=${token}`,
    );
  }

  send(to: string, subject: string, body: string): Promise<void> {
    return this.deliver(
      to,
      subject,
      `<p>${body}</p>`,
      `Email to ${to}: ${subject} — ${body}`,
    );
  }
}
