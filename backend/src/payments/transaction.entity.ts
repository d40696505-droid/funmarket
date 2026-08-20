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
import { Booking } from '../bookings/booking.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ default: 'mock_yookassa' })
  provider: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  providerTransactionId: string;

  @Index()
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  commissionAmount: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  sellerPayoutAmount: string;

  // Ставка комиссии на момент создания транзакции — только для аудита,
  // сама сумма не пересчитывается при изменении конфига (см. amount/commissionAmount).
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  commissionRateSnapshot: string;

  @Column({ default: 'RUB' })
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  providerPayload: Record<string, unknown> | null;

  // Заглушка под чек 54-ФЗ/самозанятых (amendment #2) — реальной интеграции
  // с провайдером/ФНС не строим, только слот под будущую замену.
  @Column({ type: 'varchar', nullable: true })
  receiptStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiptUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  releasedAt: Date | null;
}
