import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Request } from 'express';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  path: string;
  correlationId?: string;
}

/**
 * Interceptor: envelope padronizado de sucesso — previsível para agentes de IA.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { correlationId?: string }>();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId: request.correlationId,
      })),
    );
  }
}
