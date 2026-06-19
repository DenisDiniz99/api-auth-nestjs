import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port')!;
  const apiPrefix = configService.get<string>('apiPrefix')!;
  const corsOrigins = configService.get<string[]>('cors.origin')!;

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'X-Request-Id',
      'Idempotency-Key',
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Auth — Autenticação e Gestão de Usuários')
    .setDescription(
      'API REST de autenticação JWT e gerenciamento de usuários. ' +
        'Projetada para consumo por clientes humanos e agentes de IA.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Autenticação, tokens e reset de senha')
    .addTag('Users', 'Gestão de usuários com RBAC')
    .addTag('Health', 'Health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`OpenAPI JSON: http://localhost:${port}/api/docs-json`);
}

bootstrap();
