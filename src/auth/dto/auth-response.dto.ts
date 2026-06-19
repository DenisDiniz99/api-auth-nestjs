import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { Exclude, Expose } from 'class-transformer';

/** DTO de saída: @Exclude garante que dados sensíveis nunca vazem nas respostas */
@Exclude()
export class AuthUserResponseDto {
  @Expose()
  @ApiProperty({ example: 1 })
  id: number;

  @Expose()
  @ApiProperty({ example: 'João Silva' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'joao@example.com' })
  email: string;

  @Expose()
  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;

  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;
}

export class TokenPairResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  refreshToken: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

export class ValidateTokenResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiProperty({ example: { sub: 1, role: 'USER', jti: 'uuid' } })
  payload?: Record<string, unknown>;
}
