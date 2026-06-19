import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: number;
  role: Role;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}
