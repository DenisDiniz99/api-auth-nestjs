BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [password_hash] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [users_role_df] DEFAULT 'USER',
    [is_active] BIT NOT NULL CONSTRAINT [users_is_active_df] DEFAULT 1,
    [failed_login_attempts] INT NOT NULL CONSTRAINT [users_failed_login_attempts_df] DEFAULT 0,
    [locked_until] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[refresh_tokens] (
    [id] INT NOT NULL IDENTITY(1,1),
    [token_hash] NVARCHAR(1000) NOT NULL,
    [user_id] INT NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [revoked] BIT NOT NULL CONSTRAINT [refresh_tokens_revoked_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [refresh_tokens_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [refresh_tokens_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[password_reset_tokens] (
    [id] INT NOT NULL IDENTITY(1,1),
    [token_hash] NVARCHAR(1000) NOT NULL,
    [user_id] INT NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [used] BIT NOT NULL CONSTRAINT [password_reset_tokens_used_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [password_reset_tokens_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [password_reset_tokens_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[revoked_access_tokens] (
    [id] INT NOT NULL IDENTITY(1,1),
    [jti] NVARCHAR(1000) NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [revoked_access_tokens_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [revoked_access_tokens_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [revoked_access_tokens_jti_key] UNIQUE NONCLUSTERED ([jti])
);

-- CreateTable
CREATE TABLE [dbo].[idempotency_records] (
    [id] INT NOT NULL IDENTITY(1,1),
    [key] NVARCHAR(1000) NOT NULL,
    [response] NVARCHAR(1000) NOT NULL,
    [status_code] INT NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [idempotency_records_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [expires_at] DATETIME2 NOT NULL,
    CONSTRAINT [idempotency_records_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [idempotency_records_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [refresh_tokens_user_id_idx] ON [dbo].[refresh_tokens]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [refresh_tokens_token_hash_idx] ON [dbo].[refresh_tokens]([token_hash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [password_reset_tokens_user_id_idx] ON [dbo].[password_reset_tokens]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [password_reset_tokens_token_hash_idx] ON [dbo].[password_reset_tokens]([token_hash]);

-- AddForeignKey
ALTER TABLE [dbo].[refresh_tokens] ADD CONSTRAINT [refresh_tokens_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[password_reset_tokens] ADD CONSTRAINT [password_reset_tokens_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
