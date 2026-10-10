import { Injectable } from '@nestjs/common';
import type { TransactionClient } from './db.js';
import { PrismaService } from './prisma.service.js';
import type { UnitOfWork } from './unit-of-work.js';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.db.transaction(work);
  }
}
