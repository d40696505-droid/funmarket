import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { MailService } from '../mail/mail.service';
import { PublicUser, toPublicUser } from '../users/public-user.mapper';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { generateOpaqueToken, hashToken } from './token.util';

const PASSWORD_SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface JwtPayload {
  sub: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const verificationToken = generateOpaqueToken();

    // IsPhoneNumber('RU') на DTO уже гарантирует валидный номер — здесь
    // просто приводим к единому формату (+79991234567) независимо от того,
    // как его ввели (с пробелами/скобками/дефисами или с 8 вместо +7).
    const normalizedPhone = parsePhoneNumberFromString(dto.phone, 'RU')!.format(
      'E.164',
    );

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      role: dto.role,
      phone: normalizedPhone,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      interests: dto.interests ?? [],
      interestsOther: dto.interestsOther ?? null,
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationTokenExpiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      ),
    });

    // Сбой доставки письма не должен ломать регистрацию аккаунта — только
    // само письмо. Пользователь сможет запросить подтверждение повторно.
    try {
      await this.mailService.sendEmailVerification(user.email, verificationToken);
    } catch (err) {
      this.logger.error(
        `Не удалось отправить письмо подтверждения на ${user.email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);
    if (
      !user ||
      user.isDeleted ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        { secret: this.configService.get<string>('JWT_REFRESH_SECRET') },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findByIdWithSecrets(payload.sub);
    if (
      !user ||
      !user.refreshTokenHash ||
      user.refreshTokenHash !== hashToken(dto.refreshToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user);
  }

  async resendVerification(userId: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.isEmailVerified) {
      return { message: 'Email already verified' };
    }

    const verificationToken = generateOpaqueToken();
    await this.usersService.update(user.id, {
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationTokenExpiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      ),
    });

    try {
      await this.mailService.sendEmailVerification(
        user.email,
        verificationToken,
      );
    } catch (err) {
      this.logger.error(
        `Не удалось отправить письмо подтверждения на ${user.email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return { message: 'Verification email sent' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmailVerificationTokenHash(
      hashToken(token),
    );
    if (
      !user ||
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.update(user.id, {
      isEmailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    });

    return { message: 'Email verified' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      const token = generateOpaqueToken();
      await this.usersService.update(user.id, {
        passwordResetTokenHash: hashToken(token),
        passwordResetTokenExpiresAt: new Date(
          Date.now() + PASSWORD_RESET_TTL_MS,
        ),
      });
      try {
        await this.mailService.sendPasswordReset(user.email, token);
      } catch (err) {
        this.logger.error(
          `Не удалось отправить письмо сброса пароля на ${user.email}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
    // Ответ одинаков независимо от существования email — не даём
    // перечислять зарегистрированные адреса.
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByPasswordResetTokenHash(
      hashToken(dto.token),
    );
    if (
      !user ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_SALT_ROUNDS,
    );
    await this.usersService.update(user.id, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      refreshTokenHash: null,
    });

    return { message: 'Password updated' };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_TTL',
          '15m',
        ) as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_TTL',
          '30d',
        ) as JwtSignOptions['expiresIn'],
      }),
    ]);

    await this.usersService.update(user.id, {
      refreshTokenHash: hashToken(refreshToken),
    });

    return { accessToken, refreshToken, user: toPublicUser(user) };
  }
}
