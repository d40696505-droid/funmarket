import { IsDateString, IsString, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ProposeRescheduleDto {
  @IsDateString()
  date: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime: string;
}
