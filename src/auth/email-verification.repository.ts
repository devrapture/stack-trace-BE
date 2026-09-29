export const EMAIL_VERIFICATION_REPOSITORY = Symbol(
  'EMAIL_VERIFICATION_REPOSITORY',
);

export type EmailVerificationPurposeName = 'REGISTRATION';

export type ActiveChallenge = Readonly<{
  id: string;
  otpHash: string;
  expiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
}>;

export interface EmailVerificationChallengesRepository {
  issueWithCooldown(input: {
    userId: string;
    purpose: EmailVerificationPurposeName;
    otpHash: string;
    ttlMs: number;
    cooldownMs: number;
    maxAttempts: number;
    passwordHash?: string;
  }): Promise<void>;

  findActive(
    userId: string,
    purpose: EmailVerificationPurposeName,
  ): Promise<ActiveChallenge | null>;

  incrementAttempts(challengeId: string): Promise<void>;

  consumeAndVerifyEmail(challengeId: string, userId: string): Promise<void>;
}
