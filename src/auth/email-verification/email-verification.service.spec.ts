import { vi } from 'vitest';
import type { EmailProvider } from '../../email/email-provider.js';
import type { UserProfile } from '../../users/user.model.js';
import type { UsersRepository } from '../../users/users.repository.js';
import type { EmailVerificationChallengesRepository } from './email-verification.repository.js';
import { EmailVerificationService } from './email-verification.service.js';
import type { OtpService } from './otp.service.js';

const pendingUser: UserProfile = {
  id: 'user-id',
  publicId: 'public-id',
  role: 'USER',
  status: 'PENDING',
  avatarUrl: null,
  primaryEmail: {
    display: 'User@example.com',
    normalized: 'user@example.com',
    verified: false,
  },
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService(user: UserProfile | null) {
  const users = {
    getUserByNormalizedEmail: vi.fn().mockResolvedValue(user),
  } as unknown as UsersRepository;
  const challenges = {
    issueWithCooldown: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailVerificationChallengesRepository;
  const email = {
    send: vi
      .fn()
      .mockResolvedValue({ provider: 'resend', messageId: 'test-id' }),
  } as unknown as EmailProvider;
  const otp = {
    generate: vi.fn().mockReturnValue('123456'),
    hash: vi.fn().mockReturnValue('otp-hash'),
  } as unknown as OtpService;

  return {
    service: new EmailVerificationService(users, challenges, email, otp),
    challenges,
    email,
  };
}

describe('EmailVerificationService.resend', () => {
  it('sends a newly issued code to an unverified email', async () => {
    const { service, challenges, email } = createService(pendingUser);

    await service.resend({ email: ' USER@example.com ' });

    expect(challenges.issueWithCooldown).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: pendingUser.id,
        purpose: 'REGISTRATION',
        otpHash: 'otp-hash',
      }),
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Verify your email to join Stack Trace',
        text: expect.stringContaining('123456'),
      }),
    );
  });

  it('does not issue or send a code for an unknown or verified email', async () => {
    for (const user of [
      null,
      {
        ...pendingUser,
        primaryEmail: { ...pendingUser.primaryEmail!, verified: true },
      },
    ]) {
      const { service, challenges, email } = createService(user);

      await service.resend({ email: 'user@example.com' });

      expect(challenges.issueWithCooldown).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    }
  });

  it('does not send a code when issuance is rate limited', async () => {
    const { service, challenges, email } = createService(pendingUser);
    vi.mocked(challenges.issueWithCooldown).mockRejectedValue(
      new Error('Cooldown active'),
    );

    await expect(service.resend({ email: 'user@example.com' })).rejects.toThrow(
      'Cooldown active',
    );
    expect(email.send).not.toHaveBeenCalled();
  });
});
