import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Serviço de e-mail: em produção integraria SMTP.
 * Sem infraestrutura SMTP, tokens são logados (adequado para dev/agentes de IA).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const smtpHost = this.configService.get<string>('email.host');

    if (smtpHost) {
      this.logger.log(
        `[SMTP] Reset password email would be sent to ${email} (SMTP configured)`,
      );
      // Integração SMTP real seria implementada aqui
      return;
    }

    this.logger.warn(
      `[DEV] Password reset token for ${email}: ${token}`,
    );
    this.logger.warn(
      'Configure SMTP_HOST para envio real em produção.',
    );
  }
}
