import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const IS_PUBLIC_KEY = 'isPublic';
/** Decorator Pattern (NestJS nativo): marca rotas que bypassam o JwtAuthGuard global */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Decorator Pattern: declara papéis exigidos — verificado pelo RolesGuard */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const THROTTLE_AUTH_KEY = 'throttleAuth';
/** Marca rotas com rate limit mais restrito (login, forgot-password) */
export const ThrottleAuth = () => SetMetadata(THROTTLE_AUTH_KEY, true);
