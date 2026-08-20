import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ScheduleExceptionType {
  // Блокирует день/интервал (весь день, если оба времени NULL) — поведение
  // по умолчанию, как и раньше.
  BLOCK = 'block',
  // Открывает разовый слот вне недельного графика (например, дата, на
  // которую у продавца обычно нет расписания) — startTime/endTime/capacity
  // обязательны.
  AVAILABLE = 'available',
}

@Entity('schedule_exceptions')
export class ScheduleException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'date' })
  date: string;

  // Если оба времени NULL — блокируется весь день (только для type=block).
  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({
    type: 'enum',
    enum: ScheduleExceptionType,
    default: ScheduleExceptionType.BLOCK,
  })
  type: ScheduleExceptionType;

  // Вместимость разового слота (только для type=available); по умолчанию
  // на фронте подставляется capacity текущей услуги, но продавец может
  // скорректировать её именно для этой даты.
  @Column({ type: 'int', nullable: true })
  capacity: number | null;
}
