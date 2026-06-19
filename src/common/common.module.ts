import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { HashingServiceProvider } from './services/bcrypt-hashing.service';
import { TokenHashService } from './services/token-hash.service';

/**
 * CommonModule: agrega guards, filters, interceptors e serviços compartilhados.
 * Registrados globalmente via APP_* tokens do NestJS.
 */
@Global()
@Module({
  providers: [
    HashingServiceProvider,
    TokenHashService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
  exports: [HashingServiceProvider, TokenHashService],
})
export class CommonModule {}
