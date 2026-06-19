import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';

export interface FindUsersOptions {
  page: number;
  limit: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Repository Pattern: abstração sobre Prisma — SRP de persistência isolada do Service.
 * Facilita testes (mock) e troca de ORM sem alterar regras de negócio.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.execute(() => this.prisma.user.create({ data }));
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.execute(() =>
      this.prisma.user.findFirst({
        where: { id, deletedAt: null },
      }),
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.execute(() =>
      this.prisma.user.findFirst({
        where: { email, deletedAt: null },
      }),
    );
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.prisma.execute(() =>
      this.prisma.user.findUnique({ where: { email } }),
    );
  }

  async findMany(options: FindUsersOptions) {
    const { page, limit, search, role, isActive, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
        ],
      }),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    } as Prisma.UserOrderByWithRelationInput;

    const [items, total] = await this.prisma.execute(() =>
      Promise.all([
        this.prisma.user.findMany({ where, skip, take: limit, orderBy }),
        this.prisma.user.count({ where }),
      ]),
    );

    return { items, total, page, limit };
  }

  async update(id: number, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.execute(() =>
      this.prisma.user.update({ where: { id }, data }),
    );
  }

  async softDelete(id: number): Promise<User> {
    return this.prisma.execute(() =>
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    );
  }

  async incrementFailedAttempts(
    userId: number,
    attempts: number,
  ): Promise<void> {
    await this.prisma.execute(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: attempts },
      }),
    );
  }

  async resetLoginAttempts(userId: number): Promise<void> {
    await this.prisma.execute(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      }),
    );
  }

  async lockAccount(
    userId: number,
    attempts: number,
    lockedUntil: Date,
  ): Promise<void> {
    await this.prisma.execute(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: attempts, lockedUntil },
      }),
    );
  }
}
