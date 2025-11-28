import { IsDate, IsOptional, IsUUID } from 'class-validator';

/**
 * Base DTO with common properties for all entities
 */
export class BaseDTO {
  @IsUUID(4)
  @IsOptional()
  id?: string;

  @IsDate()
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  updatedAt?: Date;
} 