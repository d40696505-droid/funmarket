import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CITIES } from '../services/cities';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findByEmailWithSecrets(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.refreshTokenHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findSupportContact(): Promise<User | null> {
    return this.usersRepository.findOne({ where: { isSupport: true } });
  }

  findByIdWithSecrets(id: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  findByEmailVerificationTokenHash(hash: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationTokenHash')
      .addSelect('user.emailVerificationTokenExpiresAt')
      .where('user.emailVerificationTokenHash = :hash', { hash })
      .getOne();
  }

  findByPasswordResetTokenHash(hash: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetTokenHash')
      .addSelect('user.passwordResetTokenExpiresAt')
      .where('user.passwordResetTokenHash = :hash', { hash })
      .getOne();
  }

  create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.findById(id) as Promise<User>;
  }

  // Город вне canonical-списка (CITIES) помечается на модерацию — сама
  // смена применяется сразу (не блокируем пользователя), просто до
  // проверки админом город не считается "подтверждённым".
  updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const data: Partial<User> = { ...dto };
    if (dto.city !== undefined) {
      data.cityPendingModeration = Boolean(
        dto.city && !(CITIES as readonly string[]).includes(dto.city),
      );
    }
    return this.update(id, data);
  }

  findCityReviewQueue(): Promise<User[]> {
    return this.usersRepository.find({
      where: { cityPendingModeration: true },
      order: { updatedAt: 'DESC' },
    });
  }

  approveCity(id: string): Promise<User> {
    return this.update(id, { cityPendingModeration: false });
  }

  rejectCity(id: string): Promise<User> {
    return this.update(id, { city: null, cityPendingModeration: false });
  }

  // Хард-делит достаточен, пока на user_id ничего не ссылается.
  // Когда появятся bookings/reviews (Фаза 3+), заменить на анонимизацию,
  // чтобы не терять историю сделок по внешним ключам.
  async delete(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
