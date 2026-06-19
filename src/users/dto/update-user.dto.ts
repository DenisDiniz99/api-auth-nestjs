import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** ISP: DTO de atualização — campos opcionais, coeso ao caso de uso */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'João Atualizado' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
