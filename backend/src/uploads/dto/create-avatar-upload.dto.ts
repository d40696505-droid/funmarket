import { IsIn } from 'class-validator';

export class CreateAvatarUploadDto {
  @IsIn(['image/jpeg', 'image/png'])
  contentType: string;
}
