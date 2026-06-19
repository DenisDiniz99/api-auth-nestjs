import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Interceptor de idempotência: header Idempotency-Key em POST de criação.
 * Mitiga duplicidade em retries automáticos de agentes de IA.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { correlationId?: string }>();
    const response = context.switchToHttp().getResponse<Response>();

    if (request.method !== 'POST') {
      return next.handle();
    }

    const idempotencyKey = request.headers['idempotency-key'] as
      | string
      | undefined;

    if (!idempotencyKey) {
      return next.handle();
    }

    const existing = await this.prisma.execute(() =>
      this.prisma.idempotencyRecord.findUnique({
        where: { key: idempotencyKey },
      }),
    );

    if (existing && existing.expiresAt > new Date()) {
      response.status(existing.statusCode);
      return of(JSON.parse(existing.response));
    }

    return new Observable((subscriber) => {
      next.handle().subscribe({
        next: async (data) => {
          try {
            await this.prisma.execute(() =>
              this.prisma.idempotencyRecord.upsert({
                where: { key: idempotencyKey },
                create: {
                  key: idempotencyKey,
                  response: JSON.stringify(data),
                  statusCode: response.statusCode || 201,
                  expiresAt: new Date(
                    Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000,
                  ),
                },
                update: {
                  response: JSON.stringify(data),
                  statusCode: response.statusCode || 201,
                  expiresAt: new Date(
                    Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000,
                  ),
                },
              }),
            );
          } catch {
            throw new ConflictException(
              'Conflito de idempotência — requisição duplicada em processamento',
            );
          }
          subscriber.next(data);
          subscriber.complete();
        },
        error: (err) => subscriber.error(err),
      });
    });
  }
}
