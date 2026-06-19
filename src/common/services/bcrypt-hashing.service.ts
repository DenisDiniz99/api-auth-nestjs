import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  HASHING_SERVICE,
  IHashingService,
} from '../interfaces/hashing-service.interface';

/**
 * DIP: implementação concreta de IHashingService.
 * SRP: responsabilidade única — hash e comparação de senhas.
 */
@Injectable()
export class BcryptHashingService implements IHashingService {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    const rounds = this.configService.get<number>('security.bcryptSaltRounds')!;
    this.saltRounds = Math.max(rounds, 10);
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

export const HashingServiceProvider = {
  provide: HASHING_SERVICE,
  useClass: BcryptHashingService,
};
