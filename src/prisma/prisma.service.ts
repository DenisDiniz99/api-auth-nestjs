import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { ResilienceService } from '../common/services/resilience.service';

/**
 * Singleton Pattern (NestJS provider): uma única instância do PrismaClient por aplicação.
 * Prisma 7: connection URL em prisma.config.ts + driver adapter @prisma/adapter-mssql.
 * Graceful shutdown: desconecta ao receber SIGTERM via enableShutdownHooks.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly resilienceService: ResilienceService,
  ) {
    const databaseUrl = configService.get<string>('database.url');
    const adapter = new PrismaMssql(databaseUrl!);

    super({
      adapter,
      log:
        configService.get('nodeEnv') === 'development'
          ? ['query', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.resilienceService.executeWithResilience(() => this.$connect());
    this.logger.log('Prisma connected to SQL Server');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected gracefully');
  }

  /** Wrapper resiliente para operações de banco — retry + circuit breaker (cockatiel) */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.resilienceService.executeWithResilience(operation);
  }
}
