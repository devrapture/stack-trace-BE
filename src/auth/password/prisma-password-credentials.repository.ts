import { Injectable } from '@nestjs/common';
import {
  isPostgresError,
  POSTGRES_UNIQUE_VIOLATION,
} from '../../prisma/postgres-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  PasswordCredentialsRepository,
  PasswordIdentityAlreadyExistsError,
} from './password-credentials.repository.js';

@Injectable()
export class PrismaPasswordCredentialsRepository implements PasswordCredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async createForUser(userId: string, passwordHash: string): Promise<void> {
    try {
      await this.prisma.db.transaction(async (tx) => {
        const identity = await tx.orm.public.AuthIdentity.create({
          provider: 'PASSWORD',
          userId,
        });
        await tx.orm.public.PasswordCredential.create({
          authIdentityId: identity.id,
          passwordHash,
        });
      });
    } catch (error: unknown) {
      if (
        isPostgresError(error) &&
        ('sqlState' in error ? error.sqlState : error.cause.sqlState) ===
          POSTGRES_UNIQUE_VIOLATION
      ) {
        throw new PasswordIdentityAlreadyExistsError();
      }
      throw error;
    }
  }

  async updateHashForUser(userId: string, passwordHash: string): Promise<void> {
    // Overwrite the password hash when resuming an unverified registration so the latest submitted password is used.
    const identity = await this.prisma.db.orm.public.AuthIdentity.where({
      userId,
      provider: 'PASSWORD',
    })
      .include('passwordCredential')
      .first();

    if (!identity) {
      throw new Error('No password identity found for user.');
    }

    await this.prisma.db.orm.public.PasswordCredential.where({
      authIdentityId: identity.id,
    }).update({
      passwordHash,
    });
  }

  async findHashByUserId(userId: string): Promise<string | null> {
    const identity = await this.prisma.db.orm.public.AuthIdentity.where({
      userId,
      provider: 'PASSWORD',
    })
      .include('passwordCredential')
      .first();

    return identity?.passwordCredential?.passwordHash ?? null;
  }
}
