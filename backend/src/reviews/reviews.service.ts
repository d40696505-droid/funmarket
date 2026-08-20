import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { toProfileSummary } from '../users/public-user.mapper';
import { UsersService } from '../users/users.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './review.entity';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly usersService: UsersService,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto): Promise<Review> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: dto.bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Заказ не найден');
    }
    if (booking.buyerId !== reviewerId) {
      throw new ForbiddenException(
        'Оставить отзыв может только покупатель по этому заказу',
      );
    }
    // FR-7.1: отзыв доступен только после завершения заказа.
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Отзыв можно оставить только после завершения заказа',
      );
    }

    const review = this.reviewsRepository.create({
      bookingId: booking.id,
      reviewerId,
      targetId: booking.sellerId,
      rating: dto.rating,
      text: dto.text,
      photoUrls: dto.photoUrls ?? [],
    });

    let saved: Review;
    try {
      saved = await this.reviewsRepository.save(review);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === UNIQUE_VIOLATION_CODE
      ) {
        throw new ConflictException('Отзыв на этот заказ уже оставлен');
      }
      throw err;
    }

    await this.recalculateRating(booking.sellerId);
    return saved;
  }

  async reply(
    reviewId: string,
    sellerId: string,
    replyText: string,
  ): Promise<Review> {
    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }
    if (review.targetId !== sellerId) {
      throw new ForbiddenException('Нет доступа к этому отзыву');
    }
    if (review.sellerReply) {
      throw new BadRequestException('Ответ уже оставлен');
    }
    review.sellerReply = replyText;
    return this.reviewsRepository.save(review);
  }

  async findByTarget(targetId: string): Promise<Review[]> {
    const reviews = await this.reviewsRepository.find({
      where: { targetId },
      relations: { reviewer: true },
      order: { createdAt: 'DESC' },
    });
    // Публичный список — не отдаём email/телефон автора отзыва.
    return reviews.map((review) => ({
      ...review,
      reviewer: toProfileSummary(
        review.reviewer,
      ) as unknown as Review['reviewer'],
    }));
  }

  private async recalculateRating(sellerId: string): Promise<void> {
    const { avg } = (await this.reviewsRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .where('review.targetId = :sellerId', { sellerId })
      .getRawOne()) as { avg: string };

    await this.usersService.update(sellerId, {
      rating: Number(Number(avg).toFixed(2)),
    });
  }
}
