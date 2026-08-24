import type { DatabaseExecutor } from '../../../common/database/database.port';

export type EnqueueJob = {
  type: string;
  payload: Record<string, unknown>;
  runAt?: Date;
  priority?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
};

export type JobHandlerContext = {
  jobId: string;
  attempt: number;
  workerId: string;
};

export type JobHandler = (
  payload: Record<string, unknown>,
  context: JobHandlerContext,
) => Promise<void>;

export type EnqueueExecutor = DatabaseExecutor;
