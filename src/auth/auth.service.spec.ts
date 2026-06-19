import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../common/enums/role.enum';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { UsersRepository } from '../users/users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { TokenHashService } from '../common/services/token-hash.service';
import { HASHING_SERVICE } from '../common/interfaces/hashing-service.interface';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let hashingService: { hash: jest.Mock; compare: jest.Mock };
  let tokenService: jest.Mocked<TokenService>;
  let prisma: { execute: jest.Mock; refreshToken: object; passwordResetToken: object; user: object; $transaction: jest.Mock };

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hashed',
    role: Role.USER,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    hashingService = {
      hash: jest.fn().mockResolvedValue('hashed'),
      compare: jest.fn(),
    };

    usersRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      resetLoginAttempts: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      lockAccount: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    tokenService = {
      generateAccessToken: jest.fn().mockReturnValue({
        accessToken: 'access-token',
        jti: 'jti-123',
        expiresAt: new Date(),
      }),
      getRefreshTokenExpiration: jest.fn().mockReturnValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      verifyAccessToken: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;

    prisma = {
      execute: jest.fn((fn) => fn()),
      refreshToken: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      revokedAccessToken: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: { update: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: PrismaService, useValue: prisma },
        { provide: HASHING_SERVICE, useValue: hashingService },
        { provide: TokenHashService, useValue: { hashToken: jest.fn().mockReturnValue('hash'), generateSecureToken: jest.fn().mockReturnValue('raw-token') } },
        { provide: TokenService, useValue: tokenService },
        { provide: EmailService, useValue: { sendPasswordResetEmail: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, unknown> = {
                'security.maxLoginAttempts': 5,
                'security.accountLockDurationMinutes': 15,
                'security.passwordResetTokenExpirationMinutes': 30,
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('deve criar usuário com sucesso', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.create.mockResolvedValue(mockUser);

      const result = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Str0ng@Pass123',
      });

      expect(result.email).toBe('test@example.com');
      expect(hashingService.hash).toHaveBeenCalled();
    });

    it('deve lançar ConflictException se e-mail já existe', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'Str0ng@Pass123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('deve autenticar com credenciais válidas', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      hashingService.compare.mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Str0ng@Pass123',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBeDefined();
      expect(usersRepository.resetLoginAttempts).toHaveBeenCalledWith(1);
    });

    it('deve lançar UnauthorizedException com senha inválida', async () => {
      usersRepository.findByEmail.mockResolvedValue(mockUser);
      hashingService.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se usuário não existe', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'none@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateToken', () => {
    it('deve retornar valid=true para token válido', async () => {
      tokenService.verifyAccessToken.mockReturnValue({
        sub: 1,
        role: Role.USER,
        jti: 'jti-123',
      });

      const result = await service.validateToken('valid-token');
      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe(1);
    });

    it('deve retornar valid=false para token inválido', async () => {
      tokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid');
      });

      const result = await service.validateToken('invalid-token');
      expect(result.valid).toBe(false);
    });
  });
});
