import { IsDateString, IsUUID } from 'class-validator';

export class GetSlotsDto {
  @IsUUID()
  serviceId: string;

  @IsDateString()
  date: string;
}
