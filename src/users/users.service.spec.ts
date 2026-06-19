import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { HASHING_SERVICE } from '../common/interfaces/hashing-service.interface';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

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
    repository = {
      findMany: jest.fn(),
      findById: jest.fn(),
      findByEmailIncludingDeleted: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        {
          provide: HASHING_SERVICE,
          useValue: { hash: jest.fn().mockResolvedValue('hashed'), compare: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('deve retornar lista paginada', async () => {
      repository.findMany.mockResolvedValue({
        items: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('findById', () => {
    it('deve retornar usuário se ADMIN', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findById(1, {
        sub: 2,
        role: Role.ADMIN,
        jti: 'x',
      });

      expect(result.id).toBe(1);
    });

    it('deve retornar usuário se é o próprio', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findById(1, {
        sub: 1,
        role: Role.USER,
        jti: 'x',
      });

      expect(result.id).toBe(1);
    });

    it('deve lançar ForbiddenException se USER tenta acessar outro', async () => {
      repository.findById.mockResolvedValue(mockUser);

      await expect(
        service.findById(1, { sub: 2, role: Role.USER, jti: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar NotFoundException se não existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById(99, { sub: 1, role: Role.ADMIN, jti: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('deve criar usuário ADMIN', async () => {
      repository.findByEmailIncludingDeleted.mockResolvedValue(null);
      repository.create.mockResolvedValue({ ...mockUser, role: Role.ADMIN });

      const result = await service.create({
        name: 'Admin',
        email: 'admin@example.com',
        password: 'Str0ng@Pass123',
        role: Role.ADMIN,
      });

      expect(result.role).toBe(Role.ADMIN);
    });

    it('deve lançar ConflictException se e-mail existe', async () => {
      repository.findByEmailIncludingDeleted.mockResolvedValue(mockUser);

      await expect(
        service.create({
          name: 'Test',
          email: 'test@example.com',
          password: 'Str0ng@Pass123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deve fazer soft delete', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.softDelete.mockResolvedValue(mockUser);

      const result = await service.remove(1);
      expect(result.message).toContain('removido');
    });
  });
});
