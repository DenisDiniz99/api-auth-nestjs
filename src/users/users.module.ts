import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, IdempotencyInterceptor],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
