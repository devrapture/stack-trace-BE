import { TransactionClient } from '../../prisma/db';

export const PASSWORD_CREDENTIALS_REPOSITORY = Symbol(
  'PASSWORD_CREDENTIALS_REPOSITORY',
);

export class PasswordIdentityAlreadyExistsError extends Error {
  constructor() {
    super('This user already has a password identity.');
    this.name = 'PasswordIdentityAlreadyExistsError';
    Error.captureStackTrace?.(this, PasswordIdentityAlreadyExistsError);
  }
}

export interface PasswordCredentialsRepository {
  createForUser(userId: string, passwordHash: string): Promise<void>;
  updateHashForUser(
    userId: string,
    passwordHash: string,
    tx?: TransactionClient,
  ): Promise<void>;
  findHashByUserId(userId: string): Promise<string | null>;
}
