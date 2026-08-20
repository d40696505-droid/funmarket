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

export class CreateServiceDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsString()
  @MaxLength(3000)
  description: string;

  @IsUUID()
  categoryId: string;

  @IsEnum(ServicePriceType)
  priceType: ServicePriceType;

  // Требуется, если priceType != 'negotiable' — проверяется в ServicesService,
  // так как правило кросс-полевое и одинаково нужно и при create, и при update.
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsEnum(ServicePriceUnit)
  priceUnit: ServicePriceUnit;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsEnum(ServiceLocationType)
  locationType: ServiceLocationType;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsIn(CITIES)
  city: string;

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
