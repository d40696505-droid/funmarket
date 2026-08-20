import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { JwtAuthModule } from '../auth/guards/jwt-auth.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { UsersModule } from '../users/users.module';
import { ServiceImage } from './service-image.entity';
import { Service } from './service.entity';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service, ServiceImage]),
    CategoriesModule,
    JwtAuthModule,
    UsersModule,
    GeocodingModule,
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
