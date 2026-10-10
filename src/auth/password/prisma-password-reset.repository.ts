import { HttpStatus, Injectable } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { AppError } from '../../common/error/app-error.js';
import { ErrorCode } from '../../common/error/error-codes.js';
import { TransactionClient } from '../../prisma/db.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ActivePasswordResetChallenge,
  PasswordResetChallengesRepository,
} from './password-reset.repository.js';

@Injectable()
export class PrismaPasswordRepository implements PasswordResetChallengesRepository {
  private readonly db: PrismaService['db']['orm']['public'];
  constructor(private prisma: PrismaService) {
    this.db = prisma.db.orm.public;
  }

  async invalidateActiveAndCreate(input: {
    userId: string;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
    cooldownMs: number;
  }): Promise<void> {
    const db = this.prisma.db;

    const lockUser = db.raw.sql`
    SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE
    `
      .returnsRow({ id: 'pg/uuid@1' })
      .build();
    await db.transaction(async (tx) => {
      let userFound = false;
      for await (const _row of tx.query(lockUser)) {
        userFound = true;
      }
      if (!userFound)
        throw new AppError(
          ErrorCode.NOT_FOUND,
          'user not found',
          HttpStatus.NOT_FOUND,
        );

      const now = Temporal.Now.instant();
      const mostRecentChallenge =
        await tx.orm.public.PasswordResetChallenge.where({
          userId: input.userId,
        })
          .orderBy((challenge) => challenge.createdAt.desc())
          .first();

      if (
        mostRecentChallenge &&
        now.epochMilliseconds -
          mostRecentChallenge.createdAt.epochMilliseconds <
          input.cooldownMs
      ) {
        throw new AppError(
          ErrorCode.TOO_MANY_REQUESTS,
          'Please wait before requesting another code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await tx.orm.public.PasswordResetChallenge.where({
        userId: input.userId,
        consumedAt: null,
      }).updateAll({
        consumedAt: now,
      });

      await tx.orm.public.PasswordResetChallenge.create({
        userId: input.userId,
        expiresAt: Temporal.Instant.fromEpochMilliseconds(
          input.expiresAt.getTime(),
        ),
        otpHash: input.otpHash,
        maxAttempts: input.maxAttempts,
        attemptCount: 0,
      });
    });
  }

  async incrementAttempts(challengeId: string): Promise<boolean> {
    const query = this.prisma.db.raw.sql`
    UPDATE password_reset_challenge
    SET attempt_count = attempt_count + 1, updated_at = now()
WHERE id = ${challengeId}
AND consumed_at IS NULL 
AND expires_at > now()
AND attempt_count < max_attempts
    `
      .affectedCount()
      .build();

    const { affectedRows } = await this.prisma.db.runtime().execute(query);
    return affectedRows > 0;
  }

  async mostRecentIssuedAt(userId: string): Promise<Date | null> {
    const row = await this.db.PasswordResetChallenge.where({
      userId,
    })
      .orderBy((s) => s.createdAt.desc())
      .first();

    return row ? new Date(row.createdAt.epochMilliseconds) : null;
  }

  async findActive(
    userId: string,
  ): Promise<ActivePasswordResetChallenge | null> {
    const row = await this.db.PasswordResetChallenge.where({
      userId,
      consumedAt: null,
    })
      .orderBy((s) => s.createdAt.desc())
      .first();

    return row
      ? {
          id: row.id,
          otpHash: row.otpHash,
          maxAttempts: row.maxAttempts,
          attemptCount: row.attemptCount,
          expiresAt: new Date(row.expiresAt.epochMilliseconds),
        }
      : null;
  }

  async markConsumed(
    challengeId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma.db;
    await client.orm.public.PasswordResetChallenge.where({
      id: challengeId,
      consumedAt: null,
    }).update({
      consumedAt: Temporal.Now.instant(),
    });
  }
}
