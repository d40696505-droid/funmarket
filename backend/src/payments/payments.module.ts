import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/guards/jwt-auth.module';
import { Booking } from '../bookings/booking.entity';
import { ChatsModule } from '../chats/chats.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { PaymentConfig } from './payment-config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockYookassaProvider } from './providers/mock-yookassa.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { Transaction } from './transaction.entity';
import { PaymentsWebhookController } from './webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Booking, User]),
    JwtAuthModule,
    UsersModule,
    NotificationsModule,
    ChatsModule,
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    PaymentConfig,
    MockYookassaProvider,
    { provide: PAYMENT_PROVIDER, useExisting: MockYookassaProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
