import { UnauthorizedException } from '@nestjs/common';
import { vi } from 'vitest';
import type { AppConfig } from '../config/app-config.js';
import type {
  AuthSessionsRepository,
  SessionRecord,
} from './auth-sessions.repository.js';
import { JwtStrategy } from './jwt.strategy.js';

const config = {
  jwtPublicKey: 'test-public-key',
} as AppConfig;

const activeSession: SessionRecord = {
  id: 'session-id',
  userId: 'user-id',
  refreshTokenHash: 'refresh-token-hash',
  previousTokenHash: null,
  clientType: 'OTHER',
  deviceName: null,
  createdAt: new Date('2026-10-05T12:00:00Z'),
  lastUsedAt: new Date('2026-10-05T12:00:00Z'),
  expiresAt: new Date('2100-01-01T00:00:00Z'),
  revokedAt: null,
};

function createStrategy(session: SessionRecord | null) {
  const findById = vi.fn().mockResolvedValue(session);
  const repository = { findById } as unknown as AuthSessionsRepository;

  return {
    findById,
    strategy: new JwtStrategy(config, repository),
  };
}

describe('JwtStrategy', () => {
  it('accepts an access token whose session is active', async () => {
    const { findById, strategy } = createStrategy(activeSession);

    await expect(
      strategy.validate({ sub: 'user-id', sid: 'session-id' }),
    ).resolves.toEqual({ userId: 'user-id', sessionId: 'session-id' });
    expect(findById).toHaveBeenCalledWith('session-id');
  });

  it('rejects a token with missing identity claims without querying sessions', async () => {
    const { findById, strategy } = createStrategy(activeSession);

    await expect(
      strategy.validate({ sub: 'user-id', sid: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['revoked', { ...activeSession, revokedAt: new Date() }],
    [
      'expired',
      { ...activeSession, expiresAt: new Date('2020-01-01T00:00:00Z') },
    ],
    ['owned by another user', { ...activeSession, userId: 'another-user-id' }],
  ] as const)(
    'rejects a token whose session is %s',
    async (_state, session) => {
      const { strategy } = createStrategy(session);

      await expect(
        strategy.validate({ sub: 'user-id', sid: 'session-id' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
});
