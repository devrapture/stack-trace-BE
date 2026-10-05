import { HttpStatus, Injectable } from '@nestjs/common';
import { or } from '@prisma/orm-postgres/orm-client';
import { Temporal } from 'temporal-polyfill/full';
import { AppError } from '../common/error/app-error.js';
import { ErrorCode } from '../common/error/error-codes.js';
import { FieldOutputTypes } from '../prisma/contract.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AuthSessionsRepository,
  CreateSessionInput,
  SessionRecord,
  SessionRevokedReasonName,
} from './auth-sessions.repository.js';

type AuthSessionFields = FieldOutputTypes['public']['AuthSession'];

const toInstant = (date: Date): Temporal.Instant =>
  Temporal.Instant.fromEpochMilliseconds(date.getTime());

@Injectable()
export class PrismaAuthSessionsRepository implements AuthSessionsRepository {
  private readonly db: PrismaService['db']['orm']['public'];
  constructor(private readonly prisma: PrismaService) {
    this.db = prisma.db.orm.public;
  }

  async createEnforcingLimit(
    input: CreateSessionInput,
    maxActiveSessions: number,
  ): Promise<SessionRecord> {
    if (maxActiveSessions < 1)
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        'Invalid max active sessions',
        HttpStatus.BAD_REQUEST,
      );
    const db = this.prisma.db;
    const lockUser = db.raw.sql`
    SELECT "id" FROM "users"
    WHERE "id" = ${input.userId}
    FOR UPDATE;
    `
      .returnsRow({
        id: 'pg/uuid@1',
      })
      .build();

    return await db.transaction(async (tx) => {
      let userFound = false;
      for await (const _row of tx.query(lockUser)) {
        userFound = true;
      }

      if (!userFound)
        throw new AppError(
          ErrorCode.NOT_FOUND,
          'User not found',
          HttpStatus.NOT_FOUND,
        );

      /*
       * Any other login for this user is now waiting on the user's row lock.
       * This query therefore sees the result of the previous login transaction.
       */

      const now = Temporal.Now.instant();

      const activeSessions = await tx.orm.public.AuthSession.where({
        userId: input.userId,
        revokedAt: null,
      })
        .where((session) => session.expiresAt.gt(now))
        .orderBy([
          (s) => s.lastUsedAt.asc(),
          (s) => s.createdAt.asc(),
          (s) => s.id.asc(),
        ])
        .all();

      const numberToRevoke = Math.max(
        0,
        activeSessions.length - maxActiveSessions,
      );
      const sessionsToRevoke = activeSessions.slice(0, numberToRevoke);
      for (const session of sessionsToRevoke) {
        await tx.orm.public.AuthSession.where({
          revokedAt: null,
          id: session.id,
        }).update({
          revokedAt: now,
          revokedReason: 'SESSION_LIMIT_EXCEEDED',
        });
      }

      const createdSession = await tx.orm.public.AuthSession.create({
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        clientType: input.clientType,
        deviceName: input.deviceName,
        expiresAt: toInstant(input.expiresAt),
      });

      await tx.orm.public.User.where({ id: input.userId }).update({
        lastLoginAt: now,
      });

      return this.mapToSessionRecord(createdSession);
    });
  }

  async revoke(
    sessionId: string,
    reason: SessionRevokedReasonName,
  ): Promise<void> {
    await this.db.AuthSession.where({ id: sessionId }).update({
      revokedReason: reason,
      revokedAt: Temporal.Now.instant(),
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevokedReasonName,
    exceptSessionId?: string,
  ): Promise<void> {
    let session = this.db.AuthSession.where({ userId });
    if (exceptSessionId)
      session = session.where((s) => s.id.neq(exceptSessionId));
    await session.updateAll({
      revokedReason: reason,
      revokedAt: Temporal.Now.instant(),
    });
  }

  async findByCurrentOrPreviousHash(
    hash: string,
  ): Promise<SessionRecord | null> {
    const row = await this.db.AuthSession.where((s) =>
      or(s.refreshTokenHash.eq(hash), s.previousTokenHash.eq(hash)),
    ).first();

    return row ? this.mapToSessionRecord(row) : null;
  }

  async rotate(
    sessionId: string,
    input: {
      currentHash: string;
      newHash: string;
      previousHash: string;
      expiresAt: Date;
    },
  ): Promise<boolean> {
    const now = Temporal.Now.instant();
    const updated = await this.db.AuthSession.where({
      id: sessionId,
      refreshTokenHash: input.currentHash,
      revokedAt: null,
    })
      .where((session) => session.expiresAt.gt(now))
      .update({
        refreshTokenHash: input.newHash,
        previousTokenHash: input.previousHash,
        expiresAt: toInstant(input.expiresAt),
        lastUsedAt: now,
      });

    return updated !== null;
  }

  async findActiveForUser(userId: string): Promise<SessionRecord[]> {
    const rows = await this.db.AuthSession.where({
      userId,
      revokedAt: null,
    })
      .where((session) => session.expiresAt.gt(Temporal.Now.instant()))
      .orderBy((s) => s.lastUsedAt.asc())
      .all();
    return rows.map((row) => this.mapToSessionRecord(row));
  }

  async findById(sessionId: string): Promise<SessionRecord | null> {
    const row = await this.db.AuthSession.where({ id: sessionId }).first();
    return row ? this.mapToSessionRecord(row) : null;
  }

  private mapToSessionRecord(row: AuthSessionFields): SessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      deviceName: row.deviceName,
      clientType: row.clientType,
      refreshTokenHash: row.refreshTokenHash,
      previousTokenHash: row.previousTokenHash,
      revokedAt: row.revokedAt
        ? new Date(row.revokedAt.epochMilliseconds)
        : null,
      expiresAt: new Date(row.expiresAt.epochMilliseconds),
      lastUsedAt: new Date(row.lastUsedAt.epochMilliseconds),
      createdAt: new Date(row.createdAt.epochMilliseconds),
    };
  }
}
