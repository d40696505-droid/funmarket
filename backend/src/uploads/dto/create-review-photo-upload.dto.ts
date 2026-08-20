import { IsIn } from 'class-validator';

export class CreateReviewPhotoUploadDto {
  @IsIn(['image/jpeg', 'image/png'])
  contentType: string;
}
