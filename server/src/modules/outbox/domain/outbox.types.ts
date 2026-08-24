export type AppendOutboxEvent = {
  id?: string;
  topic: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
  maxAttempts?: number;
  dedupeKey?: string;
};

export type OutboxHandlerContext = {
  eventId: string;
  attempt: number;
  workerId: string;
};

export type OutboxHandler = (
  payload: Record<string, unknown>,
  context: OutboxHandlerContext,
) => Promise<void>;
