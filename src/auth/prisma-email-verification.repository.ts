import { HttpStatus, Injectable } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { AppError } from '../common/error/app-error.js';
import { ErrorCode } from '../common/error/error-codes.js';
import { FieldOutputTypes } from '../prisma/contract.js';
import {
  isPostgresError,
  POSTGRES_UNIQUE_VIOLATION,
} from '../prisma/postgres-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ActiveChallenge,
  EmailVerificationChallengesRepository,
  EmailVerificationPurposeName,
} from './email-verification.repository.js';

type EmailVerificationChallengeField =
  FieldOutputTypes['public']['EmailVerificationChallenge'];

type EmailVerificationChallengeSource = Pick<
  EmailVerificationChallengeField,
  'id' | 'otpHash' | 'expiresAt' | 'attemptCount' | 'maxAttempts'
>;

@Injectable()
export class PrismaEmailVerificationRepository implements EmailVerificationChallengesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async consumeAndVerifyEmail(
    challengeId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.db.transaction(async (tx) => {
      await tx.orm.public.EmailVerificationChallenge.where({
        id: challengeId,
      }).update({
        consumedAt: Temporal.Now.instant(),
      });
      await tx.orm.public.UserEmail.where({
        userId,
        isPrimary: true,
      }).update({
        verifiedAt: Temporal.Now.instant(),
      });
    });
  }

  async invalidateActiveAndCreate(input: {
    userId: string;
    purpose: EmailVerificationPurposeName;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }): Promise<void> {
    try {
      await this.prisma.db.transaction(async (tx) => {
        await tx.orm.public.EmailVerificationChallenge.where({
          userId: input.userId,
          purpose: input.purpose,
          consumedAt: null,
        }).updateAll({
          consumedAt: Temporal.Now.instant(),
        });
        await tx.orm.public.EmailVerificationChallenge.create({
          userId: input.userId,
          purpose: input.purpose,
          otpHash: input.otpHash,
          expiresAt: Temporal.Instant.fromEpochMilliseconds(
            input.expiresAt.getTime(),
          ),
          attemptCount: 0,
          maxAttempts: input.maxAttempts,
        });
      });
    } catch (error: unknown) {
      if (
        isPostgresError(error) &&
        ('sqlState' in error ? error.sqlState : error.cause.sqlState) ===
          POSTGRES_UNIQUE_VIOLATION
      ) {
        throw new AppError(
          ErrorCode.CONFLICT,
          'A verification code was already issued a moment ago. Please try again shortly.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async findActive(
    userId: string,
    purpose: EmailVerificationPurposeName,
  ): Promise<ActiveChallenge | null> {
    const row =
      await this.prisma.db.orm.public.EmailVerificationChallenge.where({
        userId,
        purpose,
        consumedAt: null,
      })
        .orderBy([(u) => u.createdAt.desc()])
        .first();

    return row ? this.mapToActiveChallenge(row) : null;
  }

  async incrementAttempts(challengeId: string): Promise<void> {
    const query = this.prisma.db.raw.sql`
    UPDATE email_verification_challenges
    SET attempt_count = attempt_count + 1
    WHERE id = ${challengeId}
  `
      .affectedCount()
      .build();

    await this.prisma.db.runtime().execute(query);
  }

  async mostRecentIssuedAt(
    userId: string,
    purpose: EmailVerificationPurposeName,
  ): Promise<Date | null> {
    const row =
      await this.prisma.db.orm.public.EmailVerificationChallenge.where({
        userId,
        purpose,
        consumedAt: null,
      })
        .orderBy([(u) => u.createdAt.desc()])
        .first();

    return row?.createdAt ? new Date(row.createdAt.epochMilliseconds) : null;
  }

  private mapToActiveChallenge(
    row: EmailVerificationChallengeSource,
  ): ActiveChallenge {
    return Object.freeze({
      id: row.id,
      otpHash: row.otpHash,
      expiresAt: new Date(row.expiresAt.epochMilliseconds),
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
    });
  }
}
