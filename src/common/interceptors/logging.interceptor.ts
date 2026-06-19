import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

/** Interceptor: logging estruturado de requisições com correlation-id */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { correlationId?: string }>();
    const { method, url } = request;
    const correlationId = request.correlationId ?? 'n/a';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(
            `[${correlationId}] ${method} ${url} — ${ms}ms`,
          );
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          this.logger.error(
            `[${correlationId}] ${method} ${url} — ${ms}ms — ${err.message}`,
          );
        },
      }),
    );
  }
}
