import { IsString, MaxLength } from 'class-validator';

export class RejectBookingDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
