import { z } from 'zod';

export const entityIdSchema = z.uuid();
export const requestIdSchema = z.string().trim().min(1).max(200);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export type EntityId = z.infer<typeof entityIdSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
