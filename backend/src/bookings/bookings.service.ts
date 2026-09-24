import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import dayjs from 'dayjs';
import { In, QueryFailedError, Repository } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import { ScheduleService } from '../schedule/schedule.service';
import { UsersService } from '../users/users.service';
import {
  Service,
  ServiceBookingMode,
  ServiceLocationType,
  ServicePriceType,
  ServiceStatus,
} from '../services/service.entity';
import { ChatsService } from '../chats/chats.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import {
  CONFIRMATION_TIMEOUT_FRACTION,
  CONFIRMATION_TIMEOUT_HOURS_MAX,
  DEFAULT_PAYMENT_TIMEOUT_MINUTES,
  MIN_LEAD_TIME_HOURS,
  SLOT_HOLDING_STATUSES,
} from './booking-rules';
import { Booking, BookingStatus } from './booking.entity';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { ProposeRescheduleDto } from './dto/propose-reschedule.dto';

const AUTO_REJECTION_REASON =
  'Автоматически отклонено: продавец не подтвердил бронирование вовремя';

const AUTO_CANCEL_UNPAID_REASON =
  'Автоматически отменено: оплата не поступила в течение отведённого времени';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class BookingsService {
  private readonly paymentTimeoutMinutes: number;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
    private readonly scheduleService: ScheduleService,
    private readonly notificationsService: NotificationsService,
    private readonly chatsService: ChatsService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly paymentsService: PaymentsService,
  ) {
    this.paymentTimeoutMinutes = Number(
      this.configService.get(
        'PAYMENT_TIMEOUT_MINUTES',
        DEFAULT_PAYMENT_TIMEOUT_MINUTES,
      ),
    );
  }

  // Временный режим на период, пока не решены юридические вопросы с приёмом
  // платежей (docs/release-plan.md): оплаты на платформе нет, бронь считается
  // состоявшейся сразу после подтверждения продавцом (статус CONFIRMED), а
  // расчёт стороны ведут между собой. Снимается переменной окружения
  // PAYMENTS_DISABLED — вся платёжная логика ниже осталась нетронутой.
  private get paymentsDisabled(): boolean {
    return this.configService.get<string>('PAYMENTS_DISABLED') === 'true';
  }

  // Дедлайн подтверждения — минимум из фиксированного максимума и доли
  // лид-тайма (времени от создания брони до начала услуги). Гарантированно
  // не позже начала услуги, т.к. доля <= 1.
  private getConfirmationDeadline(booking: Booking): dayjs.Dayjs {
    const slotStart = dayjs(`${booking.bookingDate}T${booking.startTime}`);
    const createdAt = dayjs(booking.createdAt);
    const leadTimeHours = slotStart.diff(createdAt, 'hour', true);
    const deadlineHours = Math.min(
      CONFIRMATION_TIMEOUT_HOURS_MAX,
      leadTimeHours * CONFIRMATION_TIMEOUT_FRACTION,
    );
    return createdAt.add(deadlineHours, 'hour');
  }

  // FR-6.3: чат создаётся вместе с первой бронью между парой пользователей
  // и получает системное сообщение о смене статуса заказа.
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

  async create(buyerId: string, dto: CreateBookingDto): Promise<Booking> {
    // Временная заглушка на период публичного тестирования без реального
    // платёжного провайдера (см. docs/release-plan.md, блокер №2) — сайт
    // остаётся доступен для просмотра/регистрации, только оформление брони
    // выключено. Снимается одной переменной окружения, без правок кода.
    if (this.configService.get<string>('ORDERS_DISABLED') === 'true') {
      throw new ServiceUnavailableException(
        'Сайт в разработке: оформление бронирования временно недоступно',
      );
    }

    const buyer = await this.usersService.findById(buyerId);
    if (!buyer?.isEmailVerified) {
      throw new ForbiddenException(
        'Подтвердите email, чтобы бронировать услуги — ссылка была отправлена при регистрации',
      );
    }

    const service = await this.servicesRepository.findOne({
      where: { id: dto.serviceId, status: ServiceStatus.ACTIVE },
      relations: { seller: true },
    });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }
    if (service.sellerId === buyerId) {
      throw new BadRequestException('Нельзя забронировать собственную услугу');
    }

    const slotStart = dayjs(`${dto.date}T${dto.startTime}`);
    if (slotStart.isBefore(dayjs().add(MIN_LEAD_TIME_HOURS, 'hour'))) {
      throw new BadRequestException(
        `Бронирование доступно не менее чем за ${MIN_LEAD_TIME_HOURS} ч до начала`,
      );
    }
    const slotEnd = slotStart.add(service.durationMinutes, 'minute');

    // Вместимость слота: для "по слотам" — берётся из уже посчитанного
    // getAvailableSlots (учитывает разовые available-исключения), для
    // "по запросу" расписания нет — используется вместимость самой услуги.
    let slotCapacity = service.capacity;

    // Продавцы в режиме "по запросу" не ведут расписание — покупатель
    // присылает пожелание по дате, а конкретное время согласуется в чате,
    // поэтому проверка против schedules здесь неприменима.
    if (service.bookingMode === ServiceBookingMode.SLOTS) {
      const availableSlots = await this.scheduleService.getAvailableSlots(
        service.sellerId,
        service.id,
        dto.date,
      );
      const matchedSlot = availableSlots.find(
        (slot) => slot.startTime === dto.startTime,
      );
      if (!matchedSlot) {
        throw new ConflictException('Выбранный слот недоступен');
      }
      slotCapacity = matchedSlot.capacity;
    }

    let locationAddress: string | null = null;
    if (service.locationType === ServiceLocationType.MOBILE) {
      if (!dto.locationAddress) {
        throw new BadRequestException(
          'Укажите адрес — услуга оказывается с выездом к клиенту',
        );
      }
      locationAddress = dto.locationAddress;
    } else if (service.locationType === ServiceLocationType.ADDRESS) {
      locationAddress = service.locationAddress;
    }

    const totalAmount =
      service.priceType === ServicePriceType.NEGOTIABLE
        ? null
        : service.priceMin;

    try {
      // Групповая вместимость (capacity > 1) означает, что несколько разных
      // покупателей могут забронировать один и тот же (sellerId, date,
      // startTime) — старый partial unique index на эту тройку (правка №5)
      // такое запрещал, поэтому занятость теперь пересчитывается вручную
      // под advisory-локом на слот (сериализует конкурентные запросы именно
      // на этот слот, не блокируя бронирования на другое время).
      const saved = await this.bookingsRepository.manager.transaction(
        async (manager) => {
          await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `${service.sellerId}|${dto.date}|${dto.startTime}`,
          ]);

          const activeBookings = await manager.find(Booking, {
            where: {
              sellerId: service.sellerId,
              bookingDate: dto.date,
              startTime: dto.startTime,
              status: In(SLOT_HOLDING_STATUSES),
            },
          });
          const blockedByOtherService = activeBookings.some(
            (b) => b.serviceId !== service.id,
          );
          if (blockedByOtherService) {
            throw new ConflictException('Выбранный слот только что заняли');
          }
          const sameServiceCount = activeBookings.filter(
            (b) => b.serviceId === service.id,
          ).length;
          if (sameServiceCount >= slotCapacity) {
            throw new ConflictException('Выбранный слот только что заняли');
          }

          const booking = manager.create(Booking, {
            serviceId: service.id,
            buyerId,
            sellerId: service.sellerId,
            bookingDate: dto.date,
            startTime: dto.startTime,
            endTime: slotEnd.format('HH:mm'),
            locationAddress,
            comment: dto.comment ?? null,
            totalAmount,
            status: BookingStatus.PENDING,
          });
          return manager.save(booking);
        },
      );
      const deadline = this.getConfirmationDeadline(saved);
      const deadlineLabel = deadline.format('DD.MM HH:mm');
      await this.notificationsService.notify(
        service.seller,
        NotificationType.BOOKING_CREATED,
        'Новое бронирование',
        `Новая заявка на «${service.title}» на ${dto.date} ${dto.startTime}. Подтвердите до ${deadlineLabel}, иначе бронь отклонится автоматически`,
        { bookingId: saved.id },
      );
      await this.notifyChat(
        buyerId,
        service.sellerId,
        saved.id,
        `Заказ создан: «${service.title}» на ${dto.date} ${dto.startTime}. Статус: ожидает подтверждения продавца до ${deadlineLabel}.`,
      );
      return saved;
    } catch (err) {
      // Страховка на уровне БД (правка №5) — если два запроса прошли проверку
      // доступности одновременно, partial unique index отклонит второй.
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === UNIQUE_VIOLATION_CODE
      ) {
        throw new ConflictException('Выбранный слот только что заняли');
      }
      throw err;
    }
  }

  async findByIdOrThrow(id: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: { service: true, buyer: true, seller: true },
    });
    if (!booking) {
      throw new NotFoundException('Заказ не найден');
    }
    return booking;
  }

  async findByIdForParticipant(id: string, userId: string): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    if (booking.buyerId !== userId && booking.sellerId !== userId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    return booking;
  }

  async confirm(
    id: string,
    sellerId: string,
    dto?: ConfirmBookingDto,
  ): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    if (booking.sellerId !== sellerId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        'Подтвердить можно только заказ в статусе "Ожидает подтверждения"',
      );
    }
    if (booking.totalAmount === null) {
      if (!dto?.fixedAmount) {
        throw new BadRequestException(
          'Услуга с договорной ценой — укажите итоговую сумму при подтверждении',
        );
      }
      booking.totalAmount = dto.fixedAmount;
    }
    if (this.paymentsDisabled) {
      booking.status = BookingStatus.CONFIRMED;
      const saved = await this.bookingsRepository.save(booking);
      await this.notificationsService.notify(
        booking.buyer,
        NotificationType.BOOKING_CONFIRMED,
        'Бронирование подтверждено',
        `Продавец подтвердил бронирование на ${booking.bookingDate} ${booking.startTime}. Оплата и детали — напрямую с продавцом, вопросы можно задать в чате`,
        { bookingId: booking.id },
      );
      await this.notifyChat(
        booking.buyerId,
        booking.sellerId,
        booking.id,
        `Заказ подтверждён продавцом. Дата: ${booking.bookingDate} ${booking.startTime}. Оплата — напрямую продавцу.`,
      );
      return saved;
    }
    booking.status = BookingStatus.AWAITING_PAYMENT;
    booking.paymentDeadline = dayjs()
      .add(this.paymentTimeoutMinutes, 'minute')
      .toDate();
    const saved = await this.bookingsRepository.save(booking);
    const deadlineLabel = dayjs(booking.paymentDeadline).format('DD.MM HH:mm');
    await this.notificationsService.notify(
      booking.buyer,
      NotificationType.BOOKING_CONFIRMED,
      'Бронирование подтверждено',
      `Продавец подтвердил бронирование на ${booking.bookingDate} ${booking.startTime}. Оплатите до ${deadlineLabel}, иначе бронь будет отменена`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      `Заказ подтверждён продавцом. Дата: ${booking.bookingDate} ${booking.startTime}. Ожидает оплаты до ${deadlineLabel}.`,
    );
    return saved;
  }

  async reject(id: string, sellerId: string, reason: string): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    if (booking.sellerId !== sellerId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        'Отклонить можно только заказ в статусе "Ожидает подтверждения"',
      );
    }
    booking.status = BookingStatus.REJECTED;
    booking.rejectionReason = reason;
    const saved = await this.bookingsRepository.save(booking);
    await this.notificationsService.notify(
      booking.buyer,
      NotificationType.BOOKING_REJECTED,
      'Бронирование отклонено',
      `Продавец отклонил бронирование на ${booking.bookingDate} ${booking.startTime}: ${reason}`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      `Заказ отклонён продавцом: ${reason}`,
    );
    return saved;
  }

  async cancel(id: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    if (booking.buyerId !== userId && booking.sellerId !== userId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.AWAITING_PAYMENT &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Отменить можно только заказ в статусе "Ожидает подтверждения" или "Ожидает оплаты". ' +
          'Оплаченный заказ отменяется через возврат средств',
      );
    }
    booking.status = BookingStatus.CANCELLED;
    if (reason) {
      booking.rejectionReason = reason;
    }
    const saved = await this.bookingsRepository.save(booking);
    const isBuyerCancelling = booking.buyerId === userId;
    const recipient = isBuyerCancelling ? booking.seller : booking.buyer;
    await this.notificationsService.notify(
      recipient,
      NotificationType.BOOKING_CANCELLED,
      'Бронирование отменено',
      `${isBuyerCancelling ? 'Покупатель' : 'Продавец'} отменил бронирование на ${booking.bookingDate} ${booking.startTime}`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      `Заказ отменён (${isBuyerCancelling ? 'покупателем' : 'продавцом'}).`,
    );
    return saved;
  }

  // Продавец предлагает новую дату/время для уже оплаченного заказа —
  // не применяется сразу, ждёт accept/reject покупателем (см. п. 2 ниже).
  async proposeReschedule(
    id: string,
    sellerId: string,
    dto: ProposeRescheduleDto,
  ): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    if (booking.sellerId !== sellerId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (
      booking.status !== BookingStatus.PAID &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Перенести можно только подтверждённый или оплаченный заказ',
      );
    }

    const newStart = dayjs(`${dto.date}T${dto.startTime}`);
    if (newStart.isBefore(dayjs().add(MIN_LEAD_TIME_HOURS, 'hour'))) {
      throw new BadRequestException(
        `Новое время должно быть не менее чем через ${MIN_LEAD_TIME_HOURS} ч от текущего момента`,
      );
    }
    const newEnd = newStart.add(booking.service.durationMinutes, 'minute');

    const conflict = await this.bookingsRepository.findOne({
      where: {
        sellerId: booking.sellerId,
        bookingDate: dto.date,
        startTime: dto.startTime,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.PAID]),
      },
    });
    if (conflict && conflict.id !== booking.id) {
      throw new ConflictException('На это время уже есть другой заказ');
    }

    booking.proposedDate = dto.date;
    booking.proposedStartTime = dto.startTime;
    booking.proposedEndTime = newEnd.format('HH:mm');
    const saved = await this.bookingsRepository.save(booking);

    await this.notificationsService.notify(
      booking.buyer,
      NotificationType.BOOKING_RESCHEDULE_PROPOSED,
      'Продавец предлагает перенести заказ',
      `Продавец предлагает перенести заказ на ${dto.date} ${dto.startTime} вместо ${booking.bookingDate} ${booking.startTime}. Подтвердите или отклоните в разделе «Мои заказы».`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      `Продавец предлагает перенести заказ на ${dto.date} ${dto.startTime}.`,
    );
    return saved;
  }

  async acceptReschedule(id: string, buyerId: string): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    if (booking.buyerId !== buyerId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (!booking.proposedDate || !booking.proposedStartTime || !booking.proposedEndTime) {
      throw new BadRequestException('Нет предложения о переносе');
    }

    const conflict = await this.bookingsRepository.findOne({
      where: {
        sellerId: booking.sellerId,
        bookingDate: booking.proposedDate,
        startTime: booking.proposedStartTime,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.PAID]),
      },
    });
    if (conflict && conflict.id !== booking.id) {
      throw new ConflictException(
        'Это время уже занято другим заказом — попросите продавца предложить другое',
      );
    }

    booking.bookingDate = booking.proposedDate;
    booking.startTime = booking.proposedStartTime;
    booking.endTime = booking.proposedEndTime;
    booking.proposedDate = null;
    booking.proposedStartTime = null;
    booking.proposedEndTime = null;
    const saved = await this.bookingsRepository.save(booking);

    await this.notificationsService.notify(
      booking.seller,
      NotificationType.BOOKING_RESCHEDULED,
      'Покупатель подтвердил перенос',
      `Покупатель подтвердил перенос заказа на ${saved.bookingDate} ${saved.startTime}`,
      { bookingId: booking.id },
    );
    await this.notifyChat(
      booking.buyerId,
      booking.sellerId,
      booking.id,
      `Покупатель подтвердил перенос заказа на ${saved.bookingDate} ${saved.startTime}.`,
    );
    return saved;
  }

  // Отклонение переноса означает, что стороны не договорились о новом
  // времени — раз продавец уже сигнализировал, что исходное время ему не
  // подходит (иначе не предлагал бы перенос), простой откат к старой дате
  // оставлял бы заказ в подвешенном состоянии. Поэтому отклонение сразу
  // отменяет заказ с полным возвратом — переиспользуем ту же логику, что
  // для самостоятельной отмены оплаченного заказа покупателем.
  async rejectReschedule(id: string, buyerId: string): Promise<Booking> {
    const booking = await this.findByIdOrThrow(id);
    if (booking.buyerId !== buyerId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    if (!booking.proposedDate) {
      throw new BadRequestException('Нет предложения о переносе');
    }

    booking.proposedDate = null;
    booking.proposedStartTime = null;
    booking.proposedEndTime = null;
    await this.bookingsRepository.save(booking);

    // Без оплаты возвращать нечего — просто отменяем заказ.
    if (booking.status === BookingStatus.CONFIRMED) {
      return this.cancel(
        id,
        buyerId,
        'Покупатель отклонил перенос — заказ отменён.',
      );
    }

    return this.paymentsService.refundBooking(
      id,
      buyerId,
      'Покупатель отклонил перенос — заказ отменён, средства возвращены покупателю.',
    );
  }

  findMine(userId: string, query: ListBookingsDto): Promise<Booking[]> {
    const as = query.as ?? 'buyer';
    return this.bookingsRepository.find({
      where: {
        ...(as === 'seller' ? { sellerId: userId } : { buyerId: userId }),
        ...(query.status ? { status: query.status } : {}),
      },
      relations: { service: true, buyer: true, seller: true },
      order: { createdAt: 'DESC' },
    });
  }

  // FR-4.3: если продавец не отреагировал до дедлайна — автоотклонение.
  // Дедлайн у каждой брони свой (см. getConfirmationDeadline) — у близких по
  // времени броней он значительно короче фиксированных 24 часов, поэтому
  // отбор кандидатов делаем в приложении, а не одним SQL-условием.
  @Cron('*/5 * * * *')
  async autoRejectExpiredBookings(): Promise<void> {
    const pending = await this.bookingsRepository.find({
      where: { status: BookingStatus.PENDING },
      relations: { buyer: true },
    });
    const now = dayjs();
    const expired = pending.filter((booking) =>
      now.isAfter(this.getConfirmationDeadline(booking)),
    );
    for (const booking of expired) {
      booking.status = BookingStatus.REJECTED;
      booking.rejectionReason = AUTO_REJECTION_REASON;
      await this.bookingsRepository.save(booking);
      await this.notificationsService.notify(
        booking.buyer,
        NotificationType.BOOKING_REJECTED,
        'Бронирование отклонено',
        `Бронирование на ${booking.bookingDate} ${booking.startTime} автоматически отклонено — продавец не ответил вовремя`,
        { bookingId: booking.id },
      );
      await this.notifyChat(
        booking.buyerId,
        booking.sellerId,
        booking.id,
        AUTO_REJECTION_REASON,
      );
    }
  }

  // Amendment #6: статус "Ожидает оплаты" имеет TTL — по истечении
  // автоматическая отмена заказа и освобождение слота (partial unique index
  // не считает cancelled активным статусом).
  @Cron('*/2 * * * *')
  async autoCancelUnpaidBookings(): Promise<void> {
    const awaitingPayment = await this.bookingsRepository.find({
      where: { status: BookingStatus.AWAITING_PAYMENT },
      relations: { buyer: true, seller: true },
    });
    const now = dayjs();
    const expired = awaitingPayment.filter(
      (booking) =>
        booking.paymentDeadline && now.isAfter(dayjs(booking.paymentDeadline)),
    );
    for (const booking of expired) {
      booking.status = BookingStatus.CANCELLED;
      booking.rejectionReason = AUTO_CANCEL_UNPAID_REASON;
      await this.bookingsRepository.save(booking);
      await this.notificationsService.notify(
        booking.buyer,
        NotificationType.PAYMENT_EXPIRED,
        'Бронирование отменено',
        `Бронирование на ${booking.bookingDate} ${booking.startTime} автоматически отменено — оплата не поступила вовремя`,
        { bookingId: booking.id },
      );
      await this.notifyChat(
        booking.buyerId,
        booking.sellerId,
        booking.id,
        AUTO_CANCEL_UNPAID_REASON,
      );
    }
  }

  // В режиме без оплаты (PAYMENTS_DISABLED) эскроу-релиз не переводит заказ
  // в COMPLETED, поэтому подтверждённые брони закрываем по времени — иначе
  // покупатель никогда не сможет оставить отзыв.
  @Cron('*/10 * * * *')
  async autoCompleteConfirmedBookings(): Promise<void> {
    if (!this.paymentsDisabled) return;
    const confirmed = await this.bookingsRepository.find({
      where: { status: BookingStatus.CONFIRMED },
      relations: { buyer: true, service: true },
    });
    const now = dayjs();
    for (const booking of confirmed) {
      if (now.isBefore(dayjs(`${booking.bookingDate}T${booking.endTime}`))) {
        continue;
      }
      booking.status = BookingStatus.COMPLETED;
      await this.bookingsRepository.save(booking);
      await this.notificationsService.notify(
        booking.buyer,
        NotificationType.BOOKING_COMPLETED,
        'Как всё прошло?',
        `Заказ «${booking.service.title}» завершён — оставьте отзыв о продавце в разделе «Мои заказы»`,
        { bookingId: booking.id },
      );
    }
  }
}
