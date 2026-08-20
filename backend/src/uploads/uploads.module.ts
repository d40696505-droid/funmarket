import { Module } from '@nestjs/common';
import { JwtAuthModule } from '../auth/guards/jwt-auth.module';
import { ServicesModule } from '../services/services.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [JwtAuthModule, ServicesModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
