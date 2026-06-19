import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

/**
 * Strategy Pattern (Passport): autenticação JWT extensível sem alterar guards.
 * OCP: novos métodos de auth podem ser adicionados como novas strategies.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const revoked = await this.prisma.execute(() =>
      this.prisma.revokedAccessToken.findUnique({
        where: { jti: payload.jti },
      }),
    );

    if (revoked) {
      throw new UnauthorizedException('Token revogado');
    }

    return {
      sub: payload.sub,
      role: payload.role,
      jti: payload.jti,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
