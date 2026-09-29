import { vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { PrismaEmailVerificationRepository } from './prisma-email-verification.repository.js';

function createRepository(consumed: object | null) {
  const challengeUpdate = vi.fn().mockResolvedValue(consumed);
  const challengeWhere = vi.fn().mockReturnValue({ update: challengeUpdate });
  const emailUpdate = vi.fn().mockResolvedValue({});
  const emailWhere = vi.fn().mockReturnValue({ update: emailUpdate });
  const userUpdate = vi.fn().mockResolvedValue({});
  const userWhere = vi.fn().mockReturnValue({ update: userUpdate });
  const tx = {
    orm: {
      public: {
        EmailVerificationChallenge: { where: challengeWhere },
        UserEmail: { where: emailWhere },
        User: { where: userWhere },
      },
    },
  };
  const prisma = {
    db: {
      transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<void>) =>
          callback(tx),
      ),
    },
  } as unknown as PrismaService;

  return {
    repository: new PrismaEmailVerificationRepository(prisma),
    challengeWhere,
    emailWhere,
    userWhere,
    userUpdate,
  };
}

describe('PrismaEmailVerificationRepository.consumeAndVerifyEmail', () => {
  it('does not verify the email when no challenge was consumed', async () => {
    const { repository, challengeWhere, emailWhere, userWhere } =
      createRepository(null);

    await repository.consumeAndVerifyEmail('challenge-id', 'user-id');

    expect(challengeWhere).toHaveBeenCalledWith({
      id: 'challenge-id',
      userId: 'user-id',
      consumedAt: null,
    });
    expect(emailWhere).not.toHaveBeenCalled();
    expect(userWhere).not.toHaveBeenCalled();
  });

  it('verifies the primary email and activates the pending user after consuming the challenge', async () => {
    const { repository, emailWhere, userWhere, userUpdate } = createRepository({
      id: 'challenge-id',
    });

    await repository.consumeAndVerifyEmail('challenge-id', 'user-id');

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
});
