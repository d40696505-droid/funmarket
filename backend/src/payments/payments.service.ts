import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import dayjs from 'dayjs';
import { In, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { ChatsService } from '../chats/chats.service';
import { NotificationType } from '../notifications/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserRole } from '../users/user.entity';
import { PaymentConfig } from './payment-config';
import type {
  CreatePaymentResult,
  PaymentProvider,
} from './providers/payment-provider.interface';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { Transaction, TransactionStatus } from './transaction.entity';

interface MockWebhookPayload {
  event: string;
  object: {
    id: string;
    status: string;
    amount: { value: string; currency: string };
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
    private readonly paymentConfig: PaymentConfig,
    private readonly notificationsService: NotificationsService,
    private readonly chatsService: ChatsService,
  ) {}

  private async notifyChat(
    buyerId: string,
    sellerId: string,
    bookingId: string,
    text: string,
  ): Promise<void> {
    const chat = await this.chatsService.findOrCreateChat(
      buyerId,
      sellerId,
      bookingId,
    );
    await this.chatsService.addSystemMessage(chat.id, text);
  }

  async initiate(
    bookingId: string,
    buyerId: string,
  ): Promise<{ redirectUrl: string; transactionId: string }> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: { service: true },
    });
    if (!booking) {
      throw new NotFoundException('Заказ не найден');
    }
    if (booking.buyerId !== buyerId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (booking.status !== BookingStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Оплата доступна только для заказа в статусе "Ожидает оплаты"',
      );
    }
    if (booking.totalAmount === null) {
      throw new BadRequestException('Сумма заказа не зафиксирована');
    }

    const activeTransaction = await this.transactionsRepository.findOne({
      where: {
        bookingId,
        status: In([TransactionStatus.PENDING, TransactionStatus.PAID]),
      },
    });
    if (activeTransaction) {
      throw new ConflictException('Оплата уже инициирована или завершена');
    }

    const commissionPercent = this.paymentConfig.commissionPercent;
    const amount = Number(booking.totalAmount);
    const commissionAmount = round2((amount * commissionPercent) / 100);
    const sellerPayoutAmount = round2(amount - commissionAmount);

    const { providerTransactionId, redirectUrl }: CreatePaymentResult =
      await this.paymentProvider.createPayment({
        bookingId: booking.id,
        amount: amount.toFixed(2),
        currency: 'RUB',
        description: `Оплата заказа «${booking.service.title}»`,
        returnUrl: `${this.paymentConfig.frontendUrl}/orders`,
      });

    const transaction = this.transactionsRepository.create({
      bookingId: booking.id,
      provider: 'mock_yookassa',
      providerTransactionId,
      status: TransactionStatus.PENDING,
      amount: amount.toFixed(2),
      commissionAmount: commissionAmount.toFixed(2),
      sellerPayoutAmount: sellerPayoutAmount.toFixed(2),
      commissionRateSnapshot: commissionPercent.toFixed(2),
      currency: 'RUB',
    });
    await this.transactionsRepository.save(transaction);

    return { redirectUrl, transactionId: providerTransactionId };
  }

  async getStatusForBooking(
    bookingId: string,
    userId: string,
  ): Promise<Transaction | null> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Заказ не найден');
    }
    if (booking.buyerId !== userId && booking.sellerId !== userId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    return this.transactionsRepository.findOne({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionForUser(
    providerTransactionId: string,
    userId: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { providerTransactionId },
      relations: { booking: { service: true, buyer: true, seller: true } },
    });
    if (!transaction) {
      throw new NotFoundException('Транзакция не найдена');
    }
    if (
      transaction.booking.buyerId !== userId &&
      transaction.booking.sellerId !== userId
    ) {
      throw new ForbiddenException('Нет доступа к этой транзакции');
    }
    return transaction;
  }

  // Amendment #7: подпись обязательна, повторная доставка — идемпотентный
  // no-op без побочных эффектов (апдейт по providerTransactionId).
  async handleWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ ok: true }> {
    if (!this.paymentProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException('Неверная подпись вебхука');
    }
    const payload = JSON.parse(rawBody) as MockWebhookPayload;
    const transaction = await this.transactionsRepository.findOne({
      where: { providerTransactionId: payload.object.id },
      relations: { booking: { buyer: true, seller: true } },
    });
    if (!transaction) {
      throw new NotFoundException('Транзакция не найдена');
    }

    if (
      transaction.status === TransactionStatus.PAID ||
      transaction.status === TransactionStatus.RELEASED
    ) {
      return { ok: true };
    }

    if (payload.object.status !== 'succeeded') {
      transaction.status = TransactionStatus.FAILED;
      transaction.providerPayload = payload as unknown as Record<
        string,
        unknown
      >;
      await this.transactionsRepository.save(transaction);
      return { ok: true };
    }

    const booking = transaction.booking;
    transaction.status = TransactionStatus.PAID;
    transaction.paidAt = new Date();
    transaction.providerPayload = payload as unknown as Record<string, unknown>;
    transaction.receiptStatus = 'stub_logged';
    await this.transactionsRepository.save(transaction);

    const serviceEnd = dayjs(`${booking.bookingDate}T${booking.endTime}`);
    booking.status = BookingStatus.PAID;
    booking.paymentDeadline = null;
    booking.escrowReleaseAt = serviceEnd
      .add(this.paymentConfig.escrowReleaseHours, 'hour')
      .toDate();
    await this.bookingsRepository.save(booking);

    await this.notificationsService.notify(
      booking.buyer,
      NotificationType.PAYMENT_RECEIVED,
      'Оплата получена',
      `Оплата заказа на ${booking.bookingDate} ${booking.startTime} прошла успешно`,
      { bookingId: booking.id },
    );
    await this.notificationsService.notify(
      booking.seller,
      NotificationType.PAYMENT_RECEIVED,
      'Заказ оплачен',
      `Покупатель оплатил заказ на ${booking.bookingDate} ${booking.startTime}`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      'Оплата получена. Средства будут переведены продавцу после оказания услуги.',
    );

    return { ok: true };
  }

  async getSellerBalance(
    sellerId: string,
  ): Promise<{ available: string; pending: string; currency: string }> {
    const rows = await this.transactionsRepository
      .createQueryBuilder('t')
      .innerJoin('t.booking', 'b')
      .select('t.status', 'status')
      .addSelect('COALESCE(SUM(t."sellerPayoutAmount"), 0)', 'total')
      .where('b."sellerId" = :sellerId', { sellerId })
      .andWhere('t.status IN (:...statuses)', {
        statuses: [TransactionStatus.PAID, TransactionStatus.RELEASED],
      })
      .groupBy('t.status')
      .getRawMany<{ status: TransactionStatus; total: string }>();

    const available =
      rows.find((r) => r.status === TransactionStatus.RELEASED)?.total ??
      '0.00';
    const pending =
      rows.find((r) => r.status === TransactionStatus.PAID)?.total ?? '0.00';
    return { available, pending, currency: 'RUB' };
  }

  getPayoutHistory(sellerId: string): Promise<Transaction[]> {
    return this.transactionsRepository
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.booking', 'b')
      .innerJoinAndSelect('b.service', 'service')
      .where('b."sellerId" = :sellerId', { sellerId })
      .orderBy('t.createdAt', 'DESC')
      .getMany();
  }

  // Раньше отмену с возвратом мог инициировать только покупатель — у
  // продавца, который не может исполнить уже оплаченный заказ, не было
  // самостоятельного пути, кроме открытия спора и ожидания админа.
  async refundBooking(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: { buyer: true, seller: true },
    });
    if (!booking) {
      throw new NotFoundException('Заказ не найден');
    }
    const isBuyer = booking.buyerId === userId;
    if (!isBuyer && booking.sellerId !== userId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (booking.status !== BookingStatus.PAID) {
      throw new BadRequestException(
        'Возврат доступен только для оплаченного заказа',
      );
    }
    const serviceStart = dayjs(`${booking.bookingDate}T${booking.startTime}`);
    if (dayjs().isAfter(serviceStart)) {
      throw new BadRequestException(
        'Дата услуги уже наступила — отмена возможна только через спор',
      );
    }
    const transaction = await this.transactionsRepository.findOne({
      where: { bookingId, status: TransactionStatus.PAID },
    });
    if (!transaction) {
      throw new NotFoundException('Оплаченная транзакция не найдена');
    }

    transaction.status = TransactionStatus.REFUNDED;
    await this.transactionsRepository.save(transaction);
    booking.status = BookingStatus.CANCELLED;
    booking.escrowReleaseAt = null;
    const saved = await this.bookingsRepository.save(booking);

    await this.notificationsService.notify(
      isBuyer ? booking.seller : booking.buyer,
      NotificationType.BOOKING_CANCELLED,
      'Заказ отменён с возвратом',
      `${isBuyer ? 'Покупатель' : 'Продавец'} отменил оплаченный заказ на ${booking.bookingDate} ${booking.startTime}, средства возвращены`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      `Заказ отменён ${isBuyer ? 'покупателем' : 'продавцом'}, средства возвращены.`,
    );
    return saved;
  }

  async dispute(
    bookingId: string,
    userId: string,
    reason: string,
  ): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: { buyer: true, seller: true },
    });
    if (!booking) {
      throw new NotFoundException('Заказ не найден');
    }
    if (booking.buyerId !== userId && booking.sellerId !== userId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (booking.status !== BookingStatus.PAID) {
      throw new BadRequestException(
        'Спор можно открыть только по оплаченному заказу',
      );
    }
    booking.status = BookingStatus.DISPUTED;
    booking.rejectionReason = reason;
    const saved = await this.bookingsRepository.save(booking);

    const isBuyer = booking.buyerId === userId;
    const recipient = isBuyer ? booking.seller : booking.buyer;
    await this.notificationsService.notify(
      recipient,
      NotificationType.BOOKING_DISPUTED,
      'Открыт спор по заказу',
      `${isBuyer ? 'Покупатель' : 'Продавец'} открыл спор по заказу на ${booking.bookingDate} ${booking.startTime}: ${reason}`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      `Открыт спор (${isBuyer ? 'покупателем' : 'продавцом'}): ${reason}. Решение примет администратор по переписке в чате.`,
    );
    return saved;
  }

  async resolveDispute(
    bookingId: string,
    resolution: 'release' | 'refund',
  ): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId },
      relations: { buyer: true, seller: true },
    });
    if (!booking) {
      throw new NotFoundException('Заказ не найден');
    }
    if (booking.status !== BookingStatus.DISPUTED) {
      throw new BadRequestException(
        'Разрешить можно только заказ в статусе "Спор"',
      );
    }
    const transaction = await this.transactionsRepository.findOne({
      where: { bookingId, status: TransactionStatus.PAID },
    });
    if (!transaction) {
      throw new NotFoundException('Оплаченная транзакция не найдена');
    }

    if (resolution === 'release') {
      transaction.status = TransactionStatus.RELEASED;
      transaction.releasedAt = new Date();
      booking.status = BookingStatus.COMPLETED;
    } else {
      transaction.status = TransactionStatus.REFUNDED;
      booking.status = BookingStatus.CANCELLED;
    }
    await this.transactionsRepository.save(transaction);
    const saved = await this.bookingsRepository.save(booking);

    const text =
      resolution === 'release'
        ? 'Администратор решил спор в пользу продавца: средства переведены.'
        : 'Администратор решил спор в пользу покупателя: средства возвращены.';
    await this.notificationsService.notify(
      booking.buyer,
      NotificationType.BOOKING_DISPUTED,
      'Спор решён',
      text,
      { bookingId: booking.id },
    );
    await this.notificationsService.notify(
      booking.seller,
      NotificationType.BOOKING_DISPUTED,
      'Спор решён',
      text,
      { bookingId: booking.id },
    );
    await this.notifyChat(booking.buyerId, booking.sellerId, booking.id, text);
    return saved;
  }

  async toggleSellerVerification(
    userId: string,
    verified: boolean,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    user.isSellerVerified = verified;
    user.sellerVerifiedAt = verified ? new Date() : null;
    return this.usersRepository.save(user);
  }

  listSellers(verified?: boolean): Promise<User[]> {
    return this.usersRepository.find({
      where: {
        role: In([UserRole.SELLER, UserRole.BOTH]),
        ...(verified !== undefined ? { isSellerVerified: verified } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  // Amendment #4: верификация гейтит только релиз эскроу, не публикацию услуг —
  // невериф. продавец просто не получает автоматический релиз, пока не пройдёт
  // верификацию (транзакция остаётся PAID).
  @Cron('*/10 * * * *')
  async autoReleaseEscrow(): Promise<void> {
    const paid = await this.transactionsRepository.find({
      where: { status: TransactionStatus.PAID },
      relations: { booking: { seller: true, buyer: true } },
    });
    const now = dayjs();
    for (const transaction of paid) {
      const booking = transaction.booking;
      if (booking.status === BookingStatus.DISPUTED) continue;
      if (
        !booking.escrowReleaseAt ||
        now.isBefore(dayjs(booking.escrowReleaseAt))
      ) {
        continue;
      }
      if (!booking.seller.isSellerVerified) continue;

      transaction.status = TransactionStatus.RELEASED;
      transaction.releasedAt = now.toDate();
      await this.transactionsRepository.save(transaction);
      booking.status = BookingStatus.COMPLETED;
      await this.bookingsRepository.save(booking);

      await this.notificationsService.notify(
        booking.seller,
        NotificationType.PAYOUT_RELEASED,
        'Выплата произведена',
        `Средства за заказ на ${booking.bookingDate} ${booking.startTime} зачислены на баланс`,
        { bookingId: booking.id },
      );
      await this.notifyChat(
        booking.buyerId,
        booking.sellerId,
        booking.id,
        'Заказ завершён, средства зачислены продавцу.',
      );
    }
  }

  // Мок-специфичный путь: имитирует «покупатель ввёл данные карты на странице
  // ЮKassa» — строит и подписывает вебхук-пейлоад сам и прогоняет его через
  // тот же handleWebhook(), что обрабатывает реальный входящий вебхук.
  async simulateCheckoutSuccess(
    providerTransactionId: string,
    userId: string,
    signPayload: (rawBody: string) => string,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { providerTransactionId },
      relations: { booking: true },
    });
    if (!transaction) {
      throw new NotFoundException('Транзакция не найдена');
    }
    if (transaction.booking.buyerId !== userId) {
      throw new ForbiddenException('Нет доступа к этой транзакции');
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Транзакция уже обработана');
    }

    const payload: MockWebhookPayload = {
      event: 'payment.succeeded',
      object: {
        id: transaction.providerTransactionId,
        status: 'succeeded',
        amount: { value: transaction.amount, currency: transaction.currency },
      },
    };
    const rawBody = JSON.stringify(payload);
    await this.handleWebhook(rawBody, signPayload(rawBody));

    const updated = await this.transactionsRepository.findOne({
      where: { id: transaction.id },
    });
    if (!updated) {
      throw new NotFoundException('Транзакция не найдена');
    }
    return updated;
  }

  async cancelCheckout(
    providerTransactionId: string,
    userId: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { providerTransactionId },
      relations: { booking: true },
    });
    if (!transaction) {
      throw new NotFoundException('Транзакция не найдена');
    }
    if (transaction.booking.buyerId !== userId) {
      throw new ForbiddenException('Нет доступа к этой транзакции');
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Транзакция уже обработана');
    }
    transaction.status = TransactionStatus.FAILED;
    return this.transactionsRepository.save(transaction);
  }
}
