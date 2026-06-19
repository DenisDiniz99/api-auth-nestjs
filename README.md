# API REST — Autenticação e Gestão de Usuários

API REST completa de autenticação JWT e gerenciamento de usuários, construída com **NestJS**, **Prisma ORM** e **SQL Server**. Projetada para consumo com contratos REST previsíveis, documentação OpenAPI e respostas padronizadas.

## Stack

| Tecnologia | Uso |
|---|---|
| NestJS | Framework HTTP, DI, Guards, Interceptors |
| Prisma | ORM com SQL Server |
| JWT + Passport | Autenticação stateless |
| bcrypt | Hash de senhas |
| Swagger | Documentação OpenAPI |
| cockatiel | Retry, circuit breaker, timeout (resiliência) |
| @nestjs/throttler | Rate limiting |
| @nestjs/terminus | Health checks |

## Arquitetura

```
src/
├── auth/          # Autenticação (login, refresh, reset, validate)
├── users/         # CRUD de usuários com RBAC
├── common/        # Guards, filters, interceptors, decorators compartilhados
├── config/        # Configuração tipada via @nestjs/config
├── prisma/        # PrismaService global com resiliência
└── health/        # Liveness/readiness
```

### Decisões técnicas

- **RBAC** com papéis `ADMIN` e `USER` via `@Roles()` + `RolesGuard`
- **JWT access token** (1 dia) com `jti` para blacklist/revogação
- **Refresh token** (7 dias) armazenado como SHA-256 no banco
- **Soft delete** em usuários (`deletedAt`)
- **Brute-force protection** com bloqueio temporário após N tentativas
- **Idempotency-Key** em POST de criação para retries de agentes de IA
- **Correlation-ID** (`X-Correlation-Id`) em todas as requisições
- **Envelope de resposta** padronizado (`success`, `data`, `timestamp`, `path`)

## Pré-requisitos

- Node.js 18+
- SQL Server (local ou remoto)
- npm

## Instalação

```bash
# 1. Clonar e instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com sua connection string do SQL Server

# 3. Gerar cliente Prisma e aplicar schema
npm run prisma:generate
npm run prisma:push   # ou: npm run prisma:migrate

# 4. Iniciar em desenvolvimento
npm run start:dev
```

## Variáveis de ambiente

Consulte [`.env.example`](.env.example) para a lista completa. Principais:

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | Connection string SQL Server (Prisma) | — |
| `JWT_SECRET` | Segredo de assinatura JWT | — |
| `BCRYPT_SALT_ROUNDS` | Rounds do bcrypt (mín. 10) | 12 |
| `MAX_LOGIN_ATTEMPTS` | Tentativas antes do bloqueio | 5 |
| `CORS_ORIGIN` | Origens permitidas (vírgula) | localhost |

## Endpoints

Base URL: `http://localhost:3000/api/v1`

### Autenticação (`/auth`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/register` | Público | Registrar usuário (USER) |
| POST | `/auth/login` | Público (rate limit) | Login → access + refresh token |
| POST | `/auth/refresh` | Público* | Renovar access token |
| POST | `/auth/logout` | Autenticado | Revogar refresh token |
| POST | `/auth/validate` | Público | Introspecção JWT |
| POST | `/auth/forgot-password` | Público (rate limit) | Solicitar reset |
| POST | `/auth/reset-password` | Público (rate limit) | Redefinir senha |
| POST | `/auth/change-password` | Autenticado | Alterar senha |

### Usuários (`/users`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/users` | ADMIN | Listar (paginação, filtro, ordenação) |
| GET | `/users/me` | Autenticado | Dados do usuário logado |
| GET | `/users/:id` | ADMIN ou próprio | Buscar por ID |
| POST | `/users` | ADMIN | Criar usuário |
| PATCH | `/users/:id` | ADMIN ou próprio | Atualizar |
| DELETE | `/users/:id` | ADMIN | Soft delete |
| PATCH | `/users/:id/role` | ADMIN | Alterar papel |

### Outros

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Health check (liveness/readiness) |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/docs-json` | OpenAPI JSON (para agentes de IA) |

## Exemplos (curl)

### Registrar

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reg-$(uuidgen)" \
  -d '{"name":"João Silva","email":"joao@example.com","password":"Str0ng@Pass123"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@example.com","password":"Str0ng@Pass123"}'
```

### Acessar rota protegida

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Resposta de sucesso (envelope)

```json
{
  "success": true,
  "data": { "id": 1, "name": "João Silva", "email": "joao@example.com" },
  "timestamp": "2024-01-15T10:00:00.000Z",
  "path": "/api/v1/users/me",
  "correlationId": "uuid"
}
```

### Resposta de erro

```json
{
  "statusCode": 401,
  "message": "Credenciais inválidas",
  "error": "Unauthorized",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "path": "/api/v1/auth/login",
  "correlationId": "uuid"
}
```

## Testes

```bash
npm test
```

Cobertura básica em `AuthService` e `UsersService` (fluxos de sucesso e falha).

## Segurança

- Senhas hasheadas com bcrypt (nunca retornadas nas respostas)
- Refresh/reset tokens armazenados como SHA-256
- Rate limiting global + restrito em `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`
- CORS configurável (nunca `*` em produção)
- Bloqueio de conta após tentativas inválidas
- Revogação de refresh tokens no logout e troca de senha
- `ValidationPipe` com `whitelist` e `forbidNonWhitelisted`

## Resiliência

- **Retry** com backoff exponencial (cockatiel) em falhas transitórias do SQL Server
- **Circuit breaker** após N falhas consecutivas
- **Timeout** configurável em operações de banco
- **Graceful shutdown** via `enableShutdownHooks()` + `$disconnect()` do Prisma

## Documentação Swagger

Acesse `http://localhost:3000/api/docs` após iniciar a aplicação.

Para introspecção automática por agentes de IA: `http://localhost:3000/api/docs-json`

## Notas sobre Prisma 7 + SQL Server

- **Prisma 7** exige `prisma.config.ts` para a connection string (não mais no `schema.prisma`)
- Driver adapter obrigatório: `@prisma/adapter-mssql` (configurado em `PrismaService`)
- **SQL Server não suporta enums nativos do Prisma** — `role` é `String` no banco, validado via enum TypeScript (`src/common/enums/role.enum.ts`)

## Licença

UNLICENSED — uso interno.
