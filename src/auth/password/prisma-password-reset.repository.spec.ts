import { vi } from 'vitest';
import { Temporal } from 'temporal-polyfill/full';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { PrismaPasswordRepository } from './prisma-password-reset.repository.js';

describe('PrismaPasswordRepository', () => {
  it('invalidates and creates the challenge on the transaction client', async () => {
    const lockQuery = {};
    const sql = vi.fn().mockReturnValue({
      returnsRow: vi.fn().mockReturnValue({
        build: vi.fn().mockReturnValue(lockQuery),
      }),
    });
    const updateAll = vi.fn().mockResolvedValue(undefined);
    const first = vi.fn().mockResolvedValue(null);
    const orderBy = vi.fn().mockReturnValue({ first });
    const where = vi.fn().mockReturnValue({ orderBy, updateAll });
    const create = vi.fn().mockResolvedValue(undefined);
    const tx = {
      query: vi.fn(async function* () {
        yield { id: 'user-id' };
      }),
      orm: {
        public: {
          PasswordResetChallenge: { where, create },
        },
      },
    };
    const outerWhere = vi.fn();
    const outerCreate = vi.fn();
    const prisma = {
      db: {
        raw: { sql },
        orm: {
          public: {
            PasswordResetChallenge: {
              where: outerWhere,
              create: outerCreate,
            },
          },
        },
        transaction: vi.fn(
          async (callback: (transaction: typeof tx) => Promise<void>) =>
            callback(tx),
        ),
      },
    } as unknown as PrismaService;

    const repository = new PrismaPasswordRepository(prisma);
    await repository.invalidateActiveAndCreate({
      userId: 'user-id',
      otpHash: 'otp-hash',
      expiresAt: new Date('2026-10-08T12:00:00.000Z'),
      maxAttempts: 5,
      cooldownMs: 60_000,
    });

    expect(tx.query).toHaveBeenCalledWith(lockQuery);
    expect(where).toHaveBeenCalledWith({
      userId: 'user-id',
      consumedAt: null,
    });
    expect(updateAll).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        otpHash: 'otp-hash',
        maxAttempts: 5,
        attemptCount: 0,
      }),
    );
    expect(outerWhere).not.toHaveBeenCalled();
    expect(outerCreate).not.toHaveBeenCalled();
  });

  it('maps the database expiry instant to a Date', async () => {
    const expiresAt = Temporal.Instant.from('2026-10-08T12:00:00Z');
    const first = vi.fn().mockResolvedValue({
      id: 'challenge-id',
      otpHash: 'otp-hash',
      expiresAt,
      attemptCount: 0,
      maxAttempts: 5,
    });
    const orderBy = vi.fn().mockReturnValue({ first });
    const where = vi.fn().mockReturnValue({ orderBy });
    const prisma = {
      db: {
        orm: {
          public: {
            PasswordResetChallenge: { where },
          },
        },
      },
    } as unknown as PrismaService;

    const repository = new PrismaPasswordRepository(prisma);
    const challenge = await repository.findActive('user-id');

    expect(challenge?.expiresAt).toBeInstanceOf(Date);
    expect(challenge?.expiresAt.toISOString()).toBe('2026-10-08T12:00:00.000Z');
  });
});
