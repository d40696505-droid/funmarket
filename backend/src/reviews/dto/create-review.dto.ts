import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  bookingId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MaxLength(1000)
  text: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  // require_tld: false — S3_PUBLIC_URL в деве/на этом сервере указывает на
  // localhost (собственный MinIO), у которого нет домена верхнего уровня.
  @IsUrl({ require_tld: false }, { each: true })
  photoUrls?: string[];
}
