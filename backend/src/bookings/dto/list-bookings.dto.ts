import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { BookingStatus } from '../booking.entity';

export class ListBookingsDto {
  @IsOptional()
  @IsIn(['buyer', 'seller'])
  as?: 'buyer' | 'seller';

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
