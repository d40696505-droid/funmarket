import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Service } from '../services/service.entity';
import { User } from '../users/user.entity';

export enum BookingStatus {
  PENDING = 'pending',
  // Legacy-значение, новым кодом не выставляется — заменено на AWAITING_PAYMENT (Фаза 4).
  CONFIRMED = 'confirmed',
  AWAITING_PAYMENT = 'awaiting_payment',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  PAID = 'paid',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Index()
  @Column()
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Index()
  @Column()
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'date' })
  bookingDate: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'varchar', nullable: true })
  locationAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  comment: string | null;

  @Index()
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason: string | null;

  // Снимок цены на момент бронирования (для fixed/range — по price_min).
  // Для negotiable — null до confirm(), продавец фиксирует сумму при подтверждении.
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  totalAmount: string | null;

  // Дедлайн оплаты после подтверждения продавцом (PENDING -> AWAITING_PAYMENT), 30 мин.
  @Column({ type: 'timestamptz', nullable: true })
  paymentDeadline: Date | null;

  // Момент автоматического релиза эскроу продавцу, ставится вебхуком после оплаты.
  @Column({ type: 'timestamptz', nullable: true })
  escrowReleaseAt: Date | null;

  // Предложенные продавцом новая дата/время для уже оплаченного заказа —
  // не применяются сразу, ждут подтверждения покупателем (propose →
  // accept/reject). Наличие proposedDate = есть незакрытое предложение.
  @Column({ type: 'date', nullable: true })
  proposedDate: string | null;

  @Column({ type: 'time', nullable: true })
  proposedStartTime: string | null;

  @Column({ type: 'time', nullable: true })
  proposedEndTime: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
