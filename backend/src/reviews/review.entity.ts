import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { User } from '../users/user.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column()
  reviewerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @Index()
  @Column()
  targetId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetId' })
  target: User;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'varchar', length: 1000 })
  text: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  photoUrls: string[];

  @Column({ type: 'varchar', length: 1000, nullable: true })
  sellerReply: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
