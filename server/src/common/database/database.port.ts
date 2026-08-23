import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export const DATABASE = Symbol('DATABASE');
export type Database = NodePgDatabase;
