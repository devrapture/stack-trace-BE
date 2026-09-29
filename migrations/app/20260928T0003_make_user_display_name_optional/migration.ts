#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/081b63f11ea91c1382a8c554e9e79e4aa7cf8dc1d716b6075693c8ac95a3be93/contract';
import endContract from '../../snapshots/081b63f11ea91c1382a8c554e9e79e4aa7cf8dc1d716b6075693c8ac95a3be93/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7fbc8e007cb179747788c801ecaadb38231ecf210404cb3ccdc0ae55c74d4739/contract';
import startContract from '../../snapshots/7fbc8e007cb179747788c801ecaadb38231ecf210404cb3ccdc0ae55c74d4739/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropNotNull({ schema: 'public', table: 'users', column: 'display_name' })];
  }
}

MigrationCLI.run(import.meta.url, M);
