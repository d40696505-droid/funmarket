import { IsIn, IsUUID } from 'class-validator';

export class CreateServiceImageUploadDto {
  @IsUUID()
  serviceId: string;

  @IsIn(['image/jpeg', 'image/png'])
  contentType: string;
}
