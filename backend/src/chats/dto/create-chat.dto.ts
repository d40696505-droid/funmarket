import { IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsUUID()
  participantId: string;
}
