import type { TransactionClient } from './db.js';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface UnitOfWork {
  run<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T>;
}
