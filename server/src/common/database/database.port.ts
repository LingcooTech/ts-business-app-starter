import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export const DATABASE = Symbol('DATABASE');
export type Database = NodePgDatabase;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DatabaseExecutor = Database | DatabaseTransaction;
