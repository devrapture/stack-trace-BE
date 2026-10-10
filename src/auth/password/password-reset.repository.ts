import { TransactionClient } from '../../prisma/db';

export const PASSWORD_RESET_REPOSITORY = Symbol('PASSWORD_RESET_REPOSITORY');

export interface ActivePasswordResetChallenge {
  id: string;
  otpHash: string;
  expiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
}

export interface PasswordResetChallengesRepository {
  claimNoticeCooldown(userId: string, cooldownMs: number): Promise<boolean>;
  invalidateActiveAndCreate(input: {
    userId: string;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
    cooldownMs: number;
  }): Promise<void>;
  findActive(userId: string): Promise<ActivePasswordResetChallenge | null>;
  incrementAttempts(challengeId: string): Promise<boolean>;
  mostRecentIssuedAt(userId: string): Promise<Date | null>;
  markConsumed(challengeId: string, tx?: TransactionClient): Promise<void>;
}
