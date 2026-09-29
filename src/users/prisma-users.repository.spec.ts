import { vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaUserRepository } from './prisma-users.repository.js';
import { UserEmailAlreadyExistsError } from './users.repository.js';

describe('PrismaUserRepository.createWithPrimaryEmailAndPassword', () => {
  async function createWithError(error: unknown): Promise<void> {
    const tx = {
      orm: {
        public: {
          User: {
            include: vi.fn().mockReturnValue({
              create: vi.fn().mockRejectedValue(error),
            }),
          },
        },
      },
    };
    const prisma = {
      db: {
        transaction: vi
          .fn()
          .mockImplementation(
            async (callback: (transaction: typeof tx) => Promise<unknown>) =>
              callback(tx),
          ),
      },
    } as unknown as PrismaService;

    const repository = new PrismaUserRepository(prisma);
    await repository.createWithPrimaryEmailAndPassword({
      email: 'Person@Example.com',
      passwordHash: 'password-hash',
    });
  }

  it.each([
    Object.assign(new Error('duplicate'), { sqlState: '23505' }),
    new Error('wrapped', { cause: { sqlState: '23505' } }),
  ])('maps direct and wrapped unique violations: %j', async (error) => {
    await expect(createWithError(error)).rejects.toBeInstanceOf(
      UserEmailAlreadyExistsError,
    );
  });

  it.each([
    new Error('unrelated'),
    new Error('wrapped', { cause: { sqlState: '23503' } }),
    Object.assign(new Error('direct state takes precedence'), {
      sqlState: '23503',
      cause: { sqlState: '23505' },
    }),
  ])('preserves other errors: %j', async (error) => {
    await expect(createWithError(error)).rejects.toBe(error);
  });
});
