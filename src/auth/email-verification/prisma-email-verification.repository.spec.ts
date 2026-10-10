import { vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { PrismaEmailVerificationRepository } from './prisma-email-verification.repository.js';

function createRepository(consumed: boolean) {
  const consumeQuery = {};
  const sql = vi.fn().mockReturnValue({
    returnsRow: vi.fn().mockReturnValue({
      build: vi.fn().mockReturnValue(consumeQuery),
    }),
  });
  const emailUpdate = vi.fn().mockResolvedValue({});
  const emailWhere = vi.fn().mockReturnValue({ update: emailUpdate });
  const userUpdate = vi.fn().mockResolvedValue({});
  const userWhere = vi.fn().mockReturnValue({ update: userUpdate });
  const tx = {
    query: vi.fn(async function* () {
      if (consumed) yield { id: 'challenge-id' };
    }),
    orm: {
      public: {
        UserEmail: { where: emailWhere },
        User: { where: userWhere },
      },
    },
  };
  const prisma = {
    db: {
      raw: { sql },
      transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<boolean>) =>
          callback(tx),
      ),
    },
  } as unknown as PrismaService;

  return {
    repository: new PrismaEmailVerificationRepository(prisma),
    consumeQuery,
    sql,
    tx,
    emailWhere,
    userWhere,
    userUpdate,
  };
}

describe('PrismaEmailVerificationRepository.consumeAndVerifyEmail', () => {
  it('does not verify the email when the conditional update consumes no challenge', async () => {
    const { repository, emailWhere, userWhere } = createRepository(false);

    await expect(
      repository.consumeAndVerifyEmail('challenge-id', 'user-id'),
    ).resolves.toBe(false);

    expect(emailWhere).not.toHaveBeenCalled();
    expect(userWhere).not.toHaveBeenCalled();
  });

  it('verifies the email and activates the user after consuming a challenge', async () => {
    const { repository, consumeQuery, tx, emailWhere, userWhere, userUpdate } =
      createRepository(true);

    await expect(
      repository.consumeAndVerifyEmail('challenge-id', 'user-id'),
    ).resolves.toBe(true);

    expect(tx.query).toHaveBeenCalledWith(consumeQuery);
    expect(emailWhere).toHaveBeenCalledWith({
      userId: 'user-id',
      isPrimary: true,
    });
    expect(userWhere).toHaveBeenCalledWith({
      id: 'user-id',
      status: 'PENDING',
    });
    expect(userUpdate).toHaveBeenCalledWith({ status: 'ACTIVE' });
  });

  it('checks expiry and attempt limit in the consuming update', async () => {
    const { repository, sql } = createRepository(false);

    await repository.consumeAndVerifyEmail('challenge-id', 'user-id');

    const [parts, challengeId, userId] = sql.mock.calls[0] as [
      TemplateStringsArray,
      string,
      string,
    ];
    const statement = parts.join('?');

    expect(challengeId).toBe('challenge-id');
    expect(userId).toBe('user-id');
    expect(statement).toMatch(/purpose = 'REGISTRATION'/);
    expect(statement).toMatch(/consumed_at IS NULL/);
    expect(statement).toMatch(/expires_at > clock_timestamp\(\)/);
    expect(statement).toMatch(/attempt_count < max_attempts/);
    expect(statement).toMatch(/RETURNING id/);
  });
});
