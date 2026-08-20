import { IsString, MaxLength } from 'class-validator';

export class DisputeBookingDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
