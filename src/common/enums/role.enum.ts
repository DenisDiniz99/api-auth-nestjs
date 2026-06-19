import { ApiProperty } from '@nestjs/swagger';

/** Enum de papéis — SQL Server não suporta enums Prisma; validação na camada de aplicação */
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export const RoleValues = Object.values(Role);

export function toRole(value: string): Role {
  return value === Role.ADMIN ? Role.ADMIN : Role.USER;
}
