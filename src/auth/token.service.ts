import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../common/enums/role.enum';
import { randomUUID } from 'crypto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

export interface AccessTokenResult {
  accessToken: string;
  jti: string;
  expiresAt: Date;
}

/**
 * Factory Pattern: centraliza geração de tokens JWT e refresh.
 * SRP: responsabilidade única de criação de tokens.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(userId: number, role: Role): AccessTokenResult {
    const jti = randomUUID();
    const expiration = this.configService.get<string>('jwt.accessExpiration')!;

    const payload: JwtPayload = { sub: userId, role, jti };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiration as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const decoded = this.jwtService.decode(accessToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    return { accessToken, jti, expiresAt };
  }

  getRefreshTokenExpiration(): Date {
    const expiration = this.configService.get<string>(
      'jwt.refreshExpiration',
    )!;
    const ms = this.parseExpirationToMs(expiration);
    return new Date(Date.now() + ms);
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }

  private parseExpirationToMs(exp: string): number {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
  }
}
