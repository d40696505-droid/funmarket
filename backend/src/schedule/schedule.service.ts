import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import dayjs from 'dayjs';
import { Between, In, Repository } from 'typeorm';
import {
  MIN_LEAD_TIME_HOURS,
  SLOT_HOLDING_STATUSES,
} from '../bookings/booking-rules';
import { Booking } from '../bookings/booking.entity';
import {
  Service,
  ServiceBookingMode,
  ServiceStatus,
} from '../services/service.entity';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import {
  ScheduleException,
  ScheduleExceptionType,
} from './schedule-exception.entity';
import { Schedule } from './schedule.entity';

// Сколько дней вперёд искать ближайший слот для карточек.
const NEXT_SLOT_LOOKAHEAD_DAYS = 14;

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  capacity: number;
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedulesRepository: Repository<Schedule>,
    @InjectRepository(ScheduleException)
    private readonly exceptionsRepository: Repository<ScheduleException>,
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  findMySchedule(sellerId: string): Promise<Schedule[]> {
    return this.schedulesRepository.find({
      where: { sellerId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async replaceSchedule(
    sellerId: string,
    dto: UpdateScheduleDto,
  ): Promise<Schedule[]> {
    for (const entry of dto.entries) {
      if (entry.startTime >= entry.endTime) {
        throw new BadRequestException('startTime должен быть раньше endTime');
      }
    }

    await this.schedulesRepository.delete({ sellerId });
    const created = this.schedulesRepository.create(
      dto.entries.map((entry) => ({ ...entry, sellerId })),
    );
    return this.schedulesRepository.save(created);
  }

  findMyExceptions(sellerId: string): Promise<ScheduleException[]> {
    return this.exceptionsRepository.find({
      where: { sellerId },
      order: { date: 'ASC' },
    });
  }

  async addException(
    sellerId: string,
    dto: CreateExceptionDto,
  ): Promise<ScheduleException> {
    const type = dto.type ?? ScheduleExceptionType.BLOCK;

    if (type === ScheduleExceptionType.AVAILABLE) {
      if (!dto.startTime || !dto.endTime || !dto.capacity) {
        throw new BadRequestException(
          'Для разового слота обязательны startTime, endTime и capacity',
        );
      }
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException('startTime должен быть раньше endTime');
      }
    } else if (
      (dto.startTime && !dto.endTime) ||
      (!dto.startTime && dto.endTime)
    ) {
      throw new BadRequestException(
        'startTime и endTime нужно указывать вместе, либо не указывать вовсе (блокировка всего дня)',
      );
    }

    const exception = this.exceptionsRepository.create({
      sellerId,
      date: dto.date,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      reason: dto.reason ?? null,
      type,
      capacity: type === ScheduleExceptionType.AVAILABLE ? dto.capacity : null,
    });
    return this.exceptionsRepository.save(exception);
  }

  async removeException(sellerId: string, id: string): Promise<void> {
    const result = await this.exceptionsRepository.delete({ id, sellerId });
    if (result.affected === 0) {
      throw new NotFoundException('Блокировка не найдена');
    }
  }

  async getAvailableSlots(
    sellerId: string,
    serviceId: string,
    date: string,
  ): Promise<AvailableSlot[]> {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId, sellerId, status: ServiceStatus.ACTIVE },
    });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }

    const dayOfWeek = dayjs(date).day();
    const scheduleEntries = await this.schedulesRepository.find({
      where: { sellerId, dayOfWeek, isActive: true },
    });
    const exceptions = await this.exceptionsRepository.find({
      where: { sellerId, date },
    });
    const activeBookings = await this.bookingsRepository.find({
      where: {
        sellerId,
        bookingDate: date,
        status: In(SLOT_HOLDING_STATUSES),
      },
    });

    return this.computeSlots(
      service,
      date,
      scheduleEntries,
      exceptions,
      activeBookings,
      dayjs().add(MIN_LEAD_TIME_HOURS, 'hour'),
    );
  }

  // Ближайший свободный слот для каждой услуги списка (карточки в каталоге).
  // Данные грузятся тремя запросами на весь список, а не по запросу на
  // каждую услугу и день; сами слоты считаются тем же computeSlots, что и
  // на странице услуги, поэтому не расходятся с реальной бронью.
  async attachNextSlots<T extends Service>(services: T[]): Promise<T[]> {
    const slotted = services.filter(
      (s) => s.bookingMode === ServiceBookingMode.SLOTS,
    );
    if (slotted.length === 0) return services;

    const sellerIds = [...new Set(slotted.map((s) => s.sellerId))];
    const today = dayjs().startOf('day');
    const from = today.format('YYYY-MM-DD');
    const to = today.add(NEXT_SLOT_LOOKAHEAD_DAYS - 1, 'day').format('YYYY-MM-DD');

    const [entries, exceptions, bookings] = await Promise.all([
      this.schedulesRepository.find({
        where: { sellerId: In(sellerIds), isActive: true },
      }),
      this.exceptionsRepository.find({
        where: { sellerId: In(sellerIds), date: Between(from, to) },
      }),
      this.bookingsRepository.find({
        where: {
          sellerId: In(sellerIds),
          bookingDate: Between(from, to),
          status: In(SLOT_HOLDING_STATUSES),
        },
      }),
    ]);

    const minStart = dayjs().add(MIN_LEAD_TIME_HOURS, 'hour');
    for (const service of slotted) {
      service.nextSlot = null;
      for (let d = 0; d < NEXT_SLOT_LOOKAHEAD_DAYS; d++) {
        const day = today.add(d, 'day');
        const date = day.format('YYYY-MM-DD');
        const slots = this.computeSlots(
          service,
          date,
          entries.filter(
            (e) => e.sellerId === service.sellerId && e.dayOfWeek === day.day(),
          ),
          exceptions.filter(
            (e) => e.sellerId === service.sellerId && e.date === date,
          ),
          bookings.filter(
            (b) => b.sellerId === service.sellerId && b.bookingDate === date,
          ),
          minStart,
        );
        if (slots.length > 0) {
          service.nextSlot = {
            date,
            startTime: slots[0].startTime,
            endTime: slots[0].endTime,
            isToday: d === 0,
          };
          break;
        }
      }
    }
    return services;
  }

  // Чистая часть расчёта слотов на одну дату: недельный график и разовые
  // исключения/брони уже загружены вызывающим.
  private computeSlots(
    service: Service,
    date: string,
    scheduleEntries: Schedule[],
    exceptions: ScheduleException[],
    activeBookings: Booking[],
    minStart: dayjs.Dayjs,
  ): AvailableSlot[] {
    const serviceId = service.id;
    const blocks = exceptions.filter(
      (e) => e.type === ScheduleExceptionType.BLOCK,
    );
    const opens = exceptions.filter(
      (e) => e.type === ScheduleExceptionType.AVAILABLE,
    );
    if (blocks.some((e) => e.startTime == null && e.endTime == null)) {
      return [];
    }

    // Окна для генерации слотов: недельный график (вместимость — из
    // карточки услуги) плюс разовые открытые слоты вне графика
    // (вместимость — своя, задана при открытии слота). Без разового
    // "available"-исключения на день без недельного правила слотов не
    // будет — это ожидаемо, а не бага.
    const windows = [
      ...scheduleEntries.map((e) => ({
        startTime: e.startTime,
        endTime: e.endTime,
        capacity: service.capacity,
      })),
      ...opens.map((e) => ({
        startTime: e.startTime as string,
        endTime: e.endTime as string,
        capacity: e.capacity ?? service.capacity,
      })),
    ];
    if (windows.length === 0) {
      return [];
    }

    const durationMinutes = service.durationMinutes;
    const slotsByStart = new Map<string, AvailableSlot>();

    for (const window of windows) {
      let cursor = dayjs(`${date}T${window.startTime}`);
      const windowEnd = dayjs(`${date}T${window.endTime}`);

      while (!cursor.add(durationMinutes, 'minute').isAfter(windowEnd)) {
        const slotStart = cursor;
        const slotEnd = cursor.add(durationMinutes, 'minute');

        const tooSoon = slotStart.isBefore(minStart);
        const blockedByException = blocks.some((exception) => {
          if (exception.startTime == null || exception.endTime == null) {
            return false;
          }
          const exStart = dayjs(`${date}T${exception.startTime}`);
          const exEnd = dayjs(`${date}T${exception.endTime}`);
          return slotStart.isBefore(exEnd) && slotEnd.isAfter(exStart);
        });
        // Брони на ДРУГИЕ услуги того же продавца полностью блокируют слот
        // (человек не может быть в двух местах одновременно). Брони на ЭТУ
        // же услугу лишь расходуют вместимость слота.
        const blockedByOtherService = activeBookings.some((booking) => {
          if (booking.serviceId === serviceId) return false;
          const bStart = dayjs(`${date}T${booking.startTime}`);
          const bEnd = dayjs(`${date}T${booking.endTime}`);
          return slotStart.isBefore(bEnd) && slotEnd.isAfter(bStart);
        });
        const sameServiceBookingsCount = activeBookings.filter((booking) => {
          if (booking.serviceId !== serviceId) return false;
          const bStart = dayjs(`${date}T${booking.startTime}`);
          const bEnd = dayjs(`${date}T${booking.endTime}`);
          return slotStart.isBefore(bEnd) && slotEnd.isAfter(bStart);
        }).length;

        if (
          !tooSoon &&
          !blockedByException &&
          !blockedByOtherService &&
          sameServiceBookingsCount < window.capacity
        ) {
          const key = slotStart.format('HH:mm');
          slotsByStart.set(key, {
            startTime: key,
            endTime: slotEnd.format('HH:mm'),
            capacity: window.capacity,
          });
        }

        cursor = cursor.add(durationMinutes, 'minute');
      }
    }

    return Array.from(slotsByStart.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }
}
