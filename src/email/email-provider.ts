export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}

export interface EmailSendResult {
  provider: 'resend';
  messageId: string;
}

export interface EmailProvider {
  send(message: EmailMessage, signal?: AbortSignal): Promise<EmailSendResult>;
}
