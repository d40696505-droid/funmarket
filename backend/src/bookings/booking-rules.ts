import { BookingStatus } from './booking.entity';

// Общие бизнес-правила бронирования — используются и в BookingsService
// (создание/автоотклонение брони), и в ScheduleService (расчёт доступных
// слотов), поэтому вынесены сюда, чтобы значения не расходились между модулями.

// Минимальный запас времени перед началом услуги, за которое ещё можно
// забронировать слот.
export const MIN_LEAD_TIME_HOURS = 1;

// Максимальное время на подтверждение продавцом — для броней с большим
// запасом до начала услуги.
export const CONFIRMATION_TIMEOUT_HOURS_MAX = 24;

// Для близких по времени броней окно на подтверждение считается как доля
// от лид-тайма (времени от создания брони до начала услуги), а не как
// фиксированные 24 часа — иначе продавец мог бы не успеть отреагировать
// до самого мероприятия.
export const CONFIRMATION_TIMEOUT_FRACTION = 0.5;

// Дефолт для PAYMENT_TIMEOUT_MINUTES (amendment #6) — переопределяется через
// ConfigService, здесь только запасное значение и для dev, и на случай
// отсутствия переменной окружения.
export const DEFAULT_PAYMENT_TIMEOUT_MINUTES = 30;

// Статусы, в которых бронь занимает слот. Раньше учитывались только
// PENDING/CONFIRMED, поэтому слот с заказом «ожидает оплаты» или «оплачен»
// снова показывался свободным и на него можно было записать второго клиента.
export const SLOT_HOLDING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.PAID,
];
