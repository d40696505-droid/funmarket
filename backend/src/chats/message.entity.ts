import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Chat } from './chat.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  chatId: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat: Chat;

  // NULL для системных сообщений (смена статуса заказа).
  @Column({ nullable: true })
  senderId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: User | null;

  @Column({ default: false })
  isSystem: boolean;

  @Column({ type: 'varchar', length: 2000 })
  text: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  imageUrls: string[];

  @Index()
  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
