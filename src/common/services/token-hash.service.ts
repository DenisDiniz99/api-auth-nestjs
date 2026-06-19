import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

/**
 * SRP: serviço dedicado a hashing de tokens (refresh/reset).
 * Nunca persistimos tokens em texto puro — apenas SHA-256.
 */
@Injectable()
export class TokenHashService {
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateSecureToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }
}
