import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  retry,
  handleWhen,
  ExponentialBackoff,
  circuitBreaker,
  ConsecutiveBreaker,
  wrap,
  TimeoutStrategy,
  timeout,
} from 'cockatiel';

/**
 * Resiliência equivalente ao Polly (.NET):
 * - Retry com backoff exponencial para falhas transitórias
 * - Circuit breaker para indisponibilidade prolongada
 * - Timeout configurável
 */
@Injectable()
export class ResilienceService {
  private readonly logger = new Logger(ResilienceService.name);
  private readonly policy: ReturnType<typeof wrap>;

  constructor(private readonly configService: ConfigService) {
    const maxAttempts = this.configService.get<number>(
      'resilience.dbRetryMaxAttempts',
    )!;
    const timeoutMs = this.configService.get<number>(
      'resilience.dbOperationTimeoutMs',
    )!;
    const threshold = this.configService.get<number>(
      'resilience.dbCircuitBreakerThreshold',
    )!;
    const halfOpenAfter = this.configService.get<number>(
      'resilience.dbCircuitBreakerHalfOpenAfterMs',
    )!;

    const isTransient = (err: Error) => {
      const msg = err.message?.toLowerCase() ?? '';
      return (
        msg.includes('timeout') ||
        msg.includes('connection') ||
        msg.includes('econnreset') ||
        msg.includes('deadlock') ||
        msg.includes('too many connections')
      );
    };

    const retryPolicy = retry(handleWhen(isTransient), {
      maxAttempts,
      backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 5000 }),
    });

    const breakerPolicy = circuitBreaker(handleWhen(isTransient), {
      halfOpenAfter,
      breaker: new ConsecutiveBreaker(threshold),
    });

    breakerPolicy.onBreak(() =>
      this.logger.warn('Circuit breaker OPEN — banco indisponível'),
    );
    breakerPolicy.onHalfOpen(() =>
      this.logger.log('Circuit breaker HALF-OPEN — testando recuperação'),
    );
    breakerPolicy.onReset(() =>
      this.logger.log('Circuit breaker CLOSED — banco recuperado'),
    );

    const timeoutPolicy = timeout(timeoutMs, TimeoutStrategy.Cooperative);

    this.policy = wrap(retryPolicy, breakerPolicy, timeoutPolicy);
  }

  async executeWithResilience<T>(fn: () => Promise<T>): Promise<T> {
    return this.policy.execute(fn) as Promise<T>;
  }
}
