import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GeoPoint } from '../geocoding/geo-point';

export enum UserRole {
  BUYER = 'buyer',
  SELLER = 'seller',
  BOTH = 'both',
}

export enum SellerType {
  PRIVATE = 'private',
  PROFESSIONAL = 'professional',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  // Профиль-«бренд» для продавцов-команд (правка №15 — платформа
  // по-прежнему требует одного самозанятого-владельца аккаунта).
  @Column({ type: 'varchar', nullable: true })
  brandName: string | null;

  @Column({ type: 'varchar', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  // Город введён вручную и не входит в canonical-список (CITIES) — ждёт
  // проверки админом (вкладка «Города на проверке»), чтобы отсечь мусор/
  // опечатки до того, как город попадёт в фильтры каталога наравне с
  // остальными.
  @Column({ default: false })
  cityPendingModeration: boolean;

  // Частный мастер (делится навыком/опытом, без формального расписания)
  // или профессиональный продавец (организованное дело) — задаёт дефолтный
  // режим бронирования новых услуг, см. Service.bookingMode.
  @Column({ type: 'enum', enum: SellerType, nullable: true })
  sellerType: SellerType | null;

  // Умения продавца — список тегов в публичном профиле, отдельно от
  // конкретных платных услуг ("умею ковать ножи", "знаю грибные места").
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  skills: string[];

  // Интересы покупателя, отмеченные при регистрации — приватные данные,
  // не должны попадать в публичные ответы (toProfileSummary/toPublicUser).
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  interests: string[];

  @Column({ type: 'varchar', nullable: true })
  interestsOther: string | null;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: GeoPoint | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewsCount: number;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isPhoneVerified: boolean;

  // Администратор платформы (раздел 3.4 ТЗ) — сотрудник, не роль покупатель/продавец.
  @Column({ default: false })
  isAdmin: boolean;

  // Аккаунт техподдержки — пользователи пишут ему через обычный чат
  // (GET /api/support/contact отдаёт id этого пользователя). Выставляется
  // напрямую в БД, тем же способом, что и isAdmin для первого админа —
  // отдельной админ-панели управления пользователями в проекте нет.
  @Column({ default: false })
  isSupport: boolean;

  // Верификация продавца перед первым выводом средств (amendment #4) —
  // не блокирует публикацию услуг, гейтит только релиз эскроу.
  @Column({ default: false })
  isSellerVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  sellerVerifiedAt: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  emailVerificationTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  emailVerificationTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  passwordResetTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  refreshTokenHash: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
