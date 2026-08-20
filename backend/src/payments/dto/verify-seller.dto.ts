import { IsBoolean } from 'class-validator';

export class VerifySellerDto {
  @IsBoolean()
  verified: boolean;
}
