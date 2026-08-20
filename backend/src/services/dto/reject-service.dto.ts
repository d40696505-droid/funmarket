import { IsString, MaxLength } from 'class-validator';

export class RejectServiceDto {
  @IsString()
  @MaxLength(1000)
  comment: string;
}
