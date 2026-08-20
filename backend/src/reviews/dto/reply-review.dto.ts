import { IsString, MaxLength } from 'class-validator';

export class ReplyReviewDto {
  @IsString()
  @MaxLength(1000)
  reply: string;
}
