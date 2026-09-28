#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7fbc8e007cb179747788c801ecaadb38231ecf210404cb3ccdc0ae55c74d4739/contract';
import endContract from '../../snapshots/7fbc8e007cb179747788c801ecaadb38231ecf210404cb3ccdc0ae55c74d4739/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d1d40059a5f42c9e867d7c1b4eda5c727a286ca2f707692c5b04c9f38b500074/contract';
import startContract from '../../snapshots/d1d40059a5f42c9e867d7c1b4eda5c727a286ca2f707692c5b04c9f38b500074/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'email_verification_challenges',
        columns: [
          col('attempt_count', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('consumed_at', 'timestamptz(3)', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expires_at', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('max_attempts', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('otp_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'email_verification_challenges_purpose_check_1462639e',
            '"purpose" IN (\'REGISTRATION\')',
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'email_verification_challenges',
        index: 'email_verification_challenges_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'email_verification_challenges',
        index: 'email_verification_challenges_user_id_purpose_idx_b55b3751',
        columns: ['user_id', 'purpose'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'email_verification_challenges',
        foreignKey: {
          name: 'email_verification_challenges_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
