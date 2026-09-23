import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Один пользователь может подписаться с нескольких устройств/браузеров —
// каждая подписка (endpoint уникален для браузера+устройства) хранится
// отдельной строкой, рассылка идёт на все сразу.
@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  endpoint: string;

  @Column()
  p256dh: string;

  @Column()
  auth: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
