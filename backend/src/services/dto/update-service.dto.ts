import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ServiceBookingMode,
  ServiceLocationType,
  ServicePriceType,
  ServicePriceUnit,
} from '../service.entity';
import { CITIES } from '../cities';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ServicePriceType)
  priceType?: ServicePriceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @IsEnum(ServicePriceUnit)
  priceUnit?: ServicePriceUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(ServiceLocationType)
  locationType?: ServiceLocationType;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsOptional()
  @IsIn(CITIES)
  city?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  travelRadiusKm?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ServiceBookingMode)
  bookingMode?: ServiceBookingMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  capacity?: number;
}
