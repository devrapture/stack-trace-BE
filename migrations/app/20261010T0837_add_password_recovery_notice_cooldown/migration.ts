#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/07deadbed90832498bc08ba1ec82b7339a91e16c96e045718292e1970953f23b/contract';
import startContract from '../../snapshots/07deadbed90832498bc08ba1ec82b7339a91e16c96e045718292e1970953f23b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ab1e5b08e1e11fbe4bd4f8c5c1f13b49cba66530f023ce6bbbfe947ec6cc94f2/contract';
import endContract from '../../snapshots/ab1e5b08e1e11fbe4bd4f8c5c1f13b49cba66530f023ce6bbbfe947ec6cc94f2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('password_recovery_notice_sent_at', 'timestamptz(3)', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
