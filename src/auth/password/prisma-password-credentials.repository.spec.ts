import { vi } from 'vitest';
import type { TransactionClient } from '../../prisma/db.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordIdentityAlreadyExistsError } from './password-credentials.repository.js';
import { PrismaPasswordCredentialsRepository } from './prisma-password-credentials.repository.js';

describe('PrismaPasswordCredentialsRepository.createForUser', () => {
  async function createWithError(error: unknown): Promise<void> {
    const prisma = {
      db: { transaction: vi.fn().mockRejectedValue(error) },
    } as unknown as PrismaService;
    const repository = new PrismaPasswordCredentialsRepository(prisma);
    await repository.createForUser('user-id', 'password-hash');
  }

  it.each([
    Object.assign(new Error('duplicate'), { sqlState: '23505' }),
    new Error('wrapped', { cause: { sqlState: '23505' } }),
    new Error('wrapped', {
      cause: Object.assign(new Error('duplicate'), { sqlState: '23505' }),
    }),
  ])('maps direct and wrapped unique violations: %j', async (error) => {
    await expect(createWithError(error)).rejects.toBeInstanceOf(
      PasswordIdentityAlreadyExistsError,
    );
  });

  it.each([
    new Error('unrelated'),
    new Error('wrapped', { cause: null }),
    new Error('wrapped', { cause: '23505' }),
    new Error('wrapped', { cause: { sqlState: 23505 } }),
    new Error('wrapped', { cause: { sqlState: '23503' } }),
    Object.assign(new Error('direct takes precedence'), {
      sqlState: '23503',
      cause: { sqlState: '23505' },
    }),
  ])('preserves other errors: %j', async (error) => {
    await expect(createWithError(error)).rejects.toBe(error);
  });
});

describe('PrismaPasswordCredentialsRepository.updateHashForUserIfCurrent', () => {
  function createRepository(options?: {
    identity?: { id: string } | null;
    updated?: object | null;
  }) {
    const first = vi
      .fn()
      .mockResolvedValue(
        options?.identity === undefined
          ? { id: 'identity-id' }
          : options.identity,
      );
    const authIdentityWhere = vi.fn().mockReturnValue({ first });
    const update = vi
      .fn()
      .mockResolvedValue(
        options?.updated === undefined
          ? { id: 'credential-id' }
          : options.updated,
      );
    const passwordCredentialWhere = vi.fn().mockReturnValue({ update });
    const transaction = {
      orm: {
        public: {
          AuthIdentity: { where: authIdentityWhere },
          PasswordCredential: { where: passwordCredentialWhere },
        },
      },
    } as unknown as TransactionClient;
    const repository = new PrismaPasswordCredentialsRepository(
      {} as PrismaService,
    );

    return {
      authIdentityWhere,
      passwordCredentialWhere,
      repository,
      transaction,
      update,
    };
  }

  it('updates only the credential whose hash is still the verified hash', async () => {
    const {
      authIdentityWhere,
      passwordCredentialWhere,
      repository,
      transaction,
      update,
    } = createRepository();

    await expect(
      repository.updateHashForUserIfCurrent(
        'user-id',
        'verified-hash',
        'new-hash',
        transaction,
      ),
    ).resolves.toBe(true);

    expect(authIdentityWhere).toHaveBeenCalledWith({
      userId: 'user-id',
      provider: 'PASSWORD',
    });
    expect(passwordCredentialWhere).toHaveBeenCalledWith({
      authIdentityId: 'identity-id',
      passwordHash: 'verified-hash',
    });
    expect(update).toHaveBeenCalledWith({ passwordHash: 'new-hash' });
  });

  it('reports a lost race when the verified hash no longer matches', async () => {
    const { repository, transaction } = createRepository({ updated: null });

    await expect(
      repository.updateHashForUserIfCurrent(
        'user-id',
        'stale-hash',
        'new-hash',
        transaction,
      ),
    ).resolves.toBe(false);
  });

  it('does not attempt an update when the password identity no longer exists', async () => {
    const { passwordCredentialWhere, repository, transaction } =
      createRepository({ identity: null });

    await expect(
      repository.updateHashForUserIfCurrent(
        'user-id',
        'verified-hash',
        'new-hash',
        transaction,
      ),
    ).resolves.toBe(false);

    expect(passwordCredentialWhere).not.toHaveBeenCalled();
  });
});
