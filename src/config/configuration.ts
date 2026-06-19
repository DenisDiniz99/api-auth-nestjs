export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '1d',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? '5', 10),
    accountLockDurationMinutes: parseInt(
      process.env.ACCOUNT_LOCK_DURATION_MINUTES ?? '15',
      10,
    ),
    passwordResetTokenExpirationMinutes: parseInt(
      process.env.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES ?? '30',
      10,
    ),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    authTtl: parseInt(process.env.THROTTLE_AUTH_TTL_MS ?? '60000', 10),
    authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '5', 10),
  },

  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
  },

  resilience: {
    dbOperationTimeoutMs: parseInt(
      process.env.DB_OPERATION_TIMEOUT_MS ?? '10000',
      10,
    ),
    dbRetryMaxAttempts: parseInt(
      process.env.DB_RETRY_MAX_ATTEMPTS ?? '3',
      10,
    ),
    dbCircuitBreakerThreshold: parseInt(
      process.env.DB_CIRCUIT_BREAKER_THRESHOLD ?? '5',
      10,
    ),
    dbCircuitBreakerHalfOpenAfterMs: parseInt(
      process.env.DB_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS ?? '30000',
      10,
    ),
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM ?? 'noreply@example.com',
  },
});
