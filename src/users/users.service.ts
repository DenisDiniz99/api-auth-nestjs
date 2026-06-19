import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, toRole } from '../common/enums/role.enum';
import { plainToInstance } from 'class-transformer';
import { HASHING_SERVICE } from '../common/interfaces/hashing-service.interface';
import type { IHashingService } from '../common/interfaces/hashing-service.interface';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import {
  PaginatedUsersResponseDto,
  UserResponseDto,
} from './dto/user-response.dto';

/**
 * SRP: UsersService — regras de negócio de gestão de usuários.
 * Controller → Service → Repository (camadas bem definidas).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(HASHING_SERVICE) private readonly hashingService: IHashingService,
  ) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const allowedSortFields = ['id', 'name', 'email', 'createdAt', 'updatedAt'];
    const sortBy = allowedSortFields.includes(query.sortBy ?? '')
      ? (query.sortBy as string)
      : 'createdAt';

    const result = await this.usersRepository.findMany({
      page,
      limit,
      search: query.search,
      role: query.role,
      isActive: query.isActive,
      sortBy,
      sortOrder: query.sortOrder ?? 'desc',
    });

    return {
      items: result.items.map((u) => this.toResponse(u)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  async findMe(userId: number): Promise<UserResponseDto> {
    return this.findById(userId, { sub: userId, role: Role.USER, jti: '' });
  }

  async findById(id: number, currentUser: JwtPayload): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.assertAccess(currentUser, id, ['read']);

    return this.toResponse(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.usersRepository.findByEmailIncludingDeleted(
      dto.email,
    );
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await this.hashingService.hash(dto.password);
    const user = await this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role ?? Role.USER,
    });

    return this.toResponse(user);
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.assertAccess(currentUser, id, ['update']);

    // USER comum só pode alterar name — ADMIN pode alterar isActive também
    const updateData: UpdateUserDto = {};
    if (dto.name !== undefined) updateData.name = dto.name;

    if (dto.isActive !== undefined) {
      if (currentUser.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'Apenas ADMIN pode alterar o status isActive',
        );
      }
      updateData.isActive = dto.isActive;
    }

    const updated = await this.usersRepository.update(id, updateData);
    return this.toResponse(updated);
  }

  async remove(id: number): Promise<{ message: string }> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.usersRepository.softDelete(id);
    return { message: 'Usuário removido com sucesso' };
  }

  async updateRole(id: number, role: Role): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const updated = await this.usersRepository.update(id, { role });
    return this.toResponse(updated);
  }

  private assertAccess(
    currentUser: JwtPayload,
    targetUserId: number,
    actions: string[],
  ): void {
    const isOwner = currentUser.sub === targetUserId;
    const isAdmin = currentUser.role === Role.ADMIN;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        `Acesso negado para ${actions.join('/')} este usuário`,
      );
    }
  }

  private toResponse(user: {
    id: number;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponseDto {
    return plainToInstance(
      UserResponseDto,
      { ...user, role: toRole(user.role) },
      { excludeExtraneousValues: true },
    );
  }
}
