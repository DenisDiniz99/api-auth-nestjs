import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, toRole } from '../common/enums/role.enum';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import {
  HASHING_SERVICE,
} from '../common/interfaces/hashing-service.interface';
import type { IHashingService } from '../common/interfaces/hashing-service.interface';
import { TokenHashService } from '../common/services/token-hash.service';
import { UsersRepository } from '../users/users.repository';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  AuthUserResponseDto,
  TokenPairResponseDto,
  ValidateTokenResponseDto,
} from './dto/auth-response.dto';

/**
 * SRP: AuthService concentra regras de negócio de autenticação.
 * DIP: depende de IHashingService (abstração), não de bcrypt diretamente.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    @Inject(HASHING_SERVICE) private readonly hashingService: IHashingService,
    private readonly tokenHashService: TokenHashService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthUserResponseDto> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await this.hashingService.hash(dto.password);
    const user = await this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: Role.USER,
    });

    return this.toUserResponse({ ...user, role: toRole(user.role) });
  }

  async login(dto: LoginDto): Promise<TokenPairResponseDto> {
    const user = await this.usersRepository.findByEmail(dto.email);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Conta bloqueada até ${user.lockedUntil.toISOString()}`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordValid = await this.hashingService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.usersRepository.resetLoginAttempts(user.id);

    return this.issueTokenPair(user.id, toRole(user.role), user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const tokenHash = this.tokenHashService.hashToken(refreshToken);

    const stored = await this.prisma.execute(() =>
      this.prisma.refreshToken.findFirst({
        where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
        include: { user: true },
      }),
    );

    if (!stored || stored.user.deletedAt || !stored.user.isActive) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const { accessToken } = this.tokenService.generateAccessToken(
      stored.userId,
      toRole(stored.user.role),
    );

    return { accessToken };
  }

  async logout(userId: number, refreshToken?: string): Promise<{ message: string }> {
    if (refreshToken) {
      const tokenHash = this.tokenHashService.hashToken(refreshToken);
      await this.prisma.execute(() =>
        this.prisma.refreshToken.updateMany({
          where: { userId, tokenHash, revoked: false },
          data: { revoked: true },
        }),
      );
    } else {
      await this.prisma.execute(() =>
        this.prisma.refreshToken.updateMany({
          where: { userId, revoked: false },
          data: { revoked: true },
        }),
      );
    }

    return { message: 'Logout realizado com sucesso' };
  }

  async validateToken(token: string): Promise<ValidateTokenResponseDto> {
    try {
      const payload = this.tokenService.verifyAccessToken(token);

      const revoked = await this.prisma.execute(() =>
        this.prisma.revokedAccessToken.findUnique({
          where: { jti: payload.jti },
        }),
      );

      if (revoked) {
        return { valid: false };
      }

      return {
        valid: true,
        payload: {
          sub: payload.sub,
          role: payload.role,
          jti: payload.jti,
          iat: payload.iat,
          exp: payload.exp,
        },
      };
    } catch {
      return { valid: false };
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersRepository.findByEmail(dto.email);

    // Resposta genérica — não revela se o e-mail existe (segurança)
    const message =
      'Se o e-mail estiver cadastrado, você receberá instruções de reset';

    if (!user || user.deletedAt) {
      return { message };
    }

    const rawToken = this.tokenHashService.generateSecureToken();
    const tokenHash = this.tokenHashService.hashToken(rawToken);
    const expirationMinutes = this.configService.get<number>(
      'security.passwordResetTokenExpirationMinutes',
    )!;

    await this.prisma.execute(() =>
      this.prisma.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000),
        },
      }),
    );

    await this.emailService.sendPasswordResetEmail(user.email, rawToken);

    return { message };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.tokenHashService.hashToken(dto.token);

    const stored = await this.prisma.execute(() =>
      this.prisma.passwordResetToken.findFirst({
        where: {
          tokenHash,
          used: false,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      }),
    );

    if (!stored) {
      throw new BadRequestException('Token de reset inválido ou expirado');
    }

    const passwordHash = await this.hashingService.hash(dto.newPassword);

    await this.prisma.execute(async () => {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: stored.userId },
          data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
        }),
        this.prisma.passwordResetToken.update({
          where: { id: stored.id },
          data: { used: true },
        }),
        this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revoked: false },
          data: { revoked: true },
        }),
      ]);
    });

    return { message: 'Senha redefinida com sucesso' };
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const valid = await this.hashingService.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!valid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const passwordHash = await this.hashingService.hash(dto.newPassword);

    await this.prisma.execute(async () => {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { passwordHash },
        }),
        this.prisma.refreshToken.updateMany({
          where: { userId, revoked: false },
          data: { revoked: true },
        }),
      ]);
    });

    return { message: 'Senha alterada com sucesso' };
  }

  private async issueTokenPair(
    userId: number,
    role: Role,
    user: { name: string; email: string; isActive: boolean },
  ): Promise<TokenPairResponseDto> {
    const { accessToken } = this.tokenService.generateAccessToken(userId, role);

    const rawRefresh = this.tokenHashService.generateSecureToken(48);
    const tokenHash = this.tokenHashService.hashToken(rawRefresh);

    await this.prisma.execute(() =>
      this.prisma.refreshToken.create({
        data: {
          tokenHash,
          userId,
          expiresAt: this.tokenService.getRefreshTokenExpiration(),
        },
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: plainToInstance(AuthUserResponseDto, {
        id: userId,
        name: user.name,
        email: user.email,
        role,
        isActive: user.isActive,
      }),
    };
  }

  private async handleFailedLogin(
    userId: number,
    currentAttempts: number,
  ): Promise<void> {
    const maxAttempts = this.configService.get<number>(
      'security.maxLoginAttempts',
    )!;
    const lockMinutes = this.configService.get<number>(
      'security.accountLockDurationMinutes',
    )!;

    const newAttempts = currentAttempts + 1;

    if (newAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      await this.usersRepository.lockAccount(userId, newAttempts, lockedUntil);
      this.logger.warn(`Conta ${userId} bloqueada até ${lockedUntil.toISOString()}`);
    } else {
      await this.usersRepository.incrementFailedAttempts(userId, newAttempts);
    }
  }

  private toUserResponse(user: {
    id: number;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
  }): AuthUserResponseDto {
    return plainToInstance(AuthUserResponseDto, user);
  }
}
