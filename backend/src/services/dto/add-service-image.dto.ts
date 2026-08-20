import { IsUrl } from 'class-validator';

export class AddServiceImageDto {
  // require_tld: false — S3_PUBLIC_URL в этом окружении указывает на
  // localhost (собственный MinIO), у которого нет домена верхнего уровня.
  @IsUrl({ require_tld: false })
  url: string;
}
