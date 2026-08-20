import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  // require_tld: false — S3_PUBLIC_URL в этом окружении указывает на
  // localhost (собственный MinIO), у которого нет домена верхнего уровня.
  @IsUrl({ require_tld: false }, { each: true })
  imageUrls?: string[];
}
