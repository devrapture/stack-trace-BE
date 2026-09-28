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
  invalidateActiveAndCreate(input: {
    userId: string;
    purpose: EmailVerificationPurposeName;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<void>;

  findActive(
    userId: string,
    purpose: EmailVerificationPurposeName,
  ): Promise<ActiveChallenge | null>;

  incrementAttempts(challengeId: string): Promise<void>;

  mostRecentIssuedAt(
    userId: string,
    purpose: EmailVerificationPurposeName,
  ): Promise<Date | null>;

  consumeAndVerifyEmail(challengeId: string, userId: string): Promise<void>;
}
