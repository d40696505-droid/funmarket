import { IsIn } from 'class-validator';

export class ResolveDisputeDto {
  @IsIn(['release', 'refund'])
  resolution: 'release' | 'refund';
}
