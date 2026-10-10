import type { PinoLogger } from 'nestjs-pino';
import { vi } from 'vitest';
import type { EmailProvider } from '../../email/email-provider.js';
import type { PrismaUnitOfWork } from '../../prisma/prisma-unit-of-work.js';
import type { AuthSessionsRepository } from '../../sessions/auth-sessions.repository.js';
import type { UserProfile } from '../../users/user.model.js';
import type { UsersRepository } from '../../users/users.repository.js';
import type { OtpService } from '../email-verification/otp.service.js';
import { OTP_RESEND_COOLDOWN_MS } from '../email-verification/otp.service.js';
import type { PasswordCredentialsRepository } from './password-credentials.repository.js';
import type { PasswordResetChallengesRepository } from './password-reset.repository.js';
import { PasswordResetService } from './password-reset.service.js';
import type { PasswordHasher } from './password.hasher.js';

const genericResponse = {
  message:
    'If an account with this email can reset its password, instructions have been sent.',
};

const activeUser: UserProfile = {
  id: 'user-id',
  publicId: 'public-id',
  role: 'USER',
  status: 'ACTIVE',
  avatarUrl: null,
  primaryEmail: {
    display: 'User@example.com',
    normalized: 'user@example.com',
    verified: true,
  },
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService(options?: {
  user?: UserProfile | null;
  passwordHash?: string | null;
  noticeCooldownClaimed?: boolean;
}) {
  const users = {
    getUserByNormalizedEmail: vi
      .fn()
      .mockResolvedValue(
        options?.user === undefined ? activeUser : options.user,
      ),
  } as unknown as UsersRepository;
  const passwords = {
    findHashByUserId: vi
      .fn()
      .mockResolvedValue(
        options?.passwordHash === undefined
          ? 'existing-password-hash'
          : options.passwordHash,
      ),
  } as unknown as PasswordCredentialsRepository;
  const email = {
    send: vi
      .fn()
      .mockResolvedValue({ provider: 'resend', messageId: 'message-id' }),
  } as unknown as EmailProvider;
  const challenges = {
    claimNoticeCooldown: vi
      .fn()
      .mockResolvedValue(options?.noticeCooldownClaimed ?? true),
    mostRecentIssuedAt: vi.fn().mockResolvedValue(null),
    invalidateActiveAndCreate: vi.fn().mockResolvedValue(undefined),
  } as unknown as PasswordResetChallengesRepository;
  const unitOfWork = {} as PrismaUnitOfWork;
  const sessions = {} as AuthSessionsRepository;
  const logger = {
    error: vi.fn(),
  } as unknown as PinoLogger;
  const otp = {
    generate: vi.fn().mockReturnValue('123456'),
    hash: vi.fn().mockReturnValue('otp-hash'),
  } as unknown as OtpService;
  const hasher = {} as PasswordHasher;

  return {
    service: new PasswordResetService(
      users,
      passwords,
      email,
      challenges,
      unitOfWork,
      sessions,
      logger,
      otp,
      hasher,
    ),
    challenges,
    email,
    logger,
  };
}

describe('PasswordResetService.forgotPassword', () => {
  it.each([
    [
      'unverified account notice',
      {
        user: {
          ...activeUser,
          status: 'PENDING' as const,
          primaryEmail: {
            ...activeUser.primaryEmail!,
            verified: false,
          },
        },
      },
      'unverified_account_password_reset_notice',
    ],
    [
      'OAuth-only account notice',
      { user: activeUser, passwordHash: null },
      'oauth_only_account_notice',
    ],
    [
      'password reset OTP',
      { user: activeUser, passwordHash: 'existing-password-hash' },
      'password_reset_otp',
    ],
  ])(
    'returns the generic response when the %s delivery fails',
    async (_name, options, notification) => {
      const { service, email, logger } = createService(options);
      vi.mocked(email.send).mockRejectedValue(
        new Error('Delivery failed for User@example.com'),
      );

      await expect(
        service.forgotPassword({ email: 'User@example.com' }),
      ).resolves.toEqual(genericResponse);

      expect(logger.error).toHaveBeenCalledWith(
        {
          userId: activeUser.id,
          notification,
          errorName: 'Error',
        },
        'Recovery email delivery failed',
      );
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
        'User@example.com',
      );
    },
  );

  it.each([
    [
      'unverified account',
      {
        ...activeUser,
        status: 'PENDING' as const,
        primaryEmail: { ...activeUser.primaryEmail!, verified: false },
      },
      'existing-password-hash',
    ],
    ['OAuth-only account', activeUser, null],
  ])(
    'does not send another notice during the %s cooldown',
    async (_name, user, passwordHash) => {
      const { service, challenges, email } = createService({
        user,
        passwordHash,
        noticeCooldownClaimed: false,
      });

      await expect(
        service.forgotPassword({ email: 'user@example.com' }),
      ).resolves.toEqual(genericResponse);

      expect(challenges.claimNoticeCooldown).toHaveBeenCalledWith(
        activeUser.id,
        OTP_RESEND_COOLDOWN_MS,
      );
      expect(email.send).not.toHaveBeenCalled();
    },
  );
});
