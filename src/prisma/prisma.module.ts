import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ResilienceService } from '../common/services/resilience.service';

/** Módulo global: Prisma disponível em toda a aplicação sem re-importar */
@Global()
@Module({
  providers: [PrismaService, ResilienceService],
  exports: [PrismaService, ResilienceService],
})
export class PrismaModule {}
