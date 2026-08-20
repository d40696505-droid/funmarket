import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Category } from '../categories/category.entity';
import { Chat } from '../chats/chat.entity';
import { MessageReport } from '../chats/message-report.entity';
import { Message } from '../chats/message.entity';
import { Favorite } from '../favorites/favorite.entity';
import { Notification } from '../notifications/notification.entity';
import { Review } from '../reviews/review.entity';
import { ScheduleException } from '../schedule/schedule-exception.entity';
import { Schedule } from '../schedule/schedule.entity';
import { ServiceImage } from '../services/service-image.entity';
import { Service } from '../services/service.entity';
import { Transaction } from '../payments/transaction.entity';
import { User } from '../users/user.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'funmarket',
  password: process.env.DB_PASSWORD ?? 'funmarket',
  database: process.env.DB_NAME ?? 'funmarket',
  entities: [
    User,
    Category,
    Service,
    ServiceImage,
    Schedule,
    ScheduleException,
    Booking,
    Notification,
    Chat,
    Message,
    MessageReport,
    Review,
    Transaction,
    Favorite,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
