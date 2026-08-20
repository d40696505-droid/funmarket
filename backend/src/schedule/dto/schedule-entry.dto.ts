import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleEntryDto {
  @IsIn([0, 1, 2, 3, 4, 5, 6])
  dayOfWeek: number;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
