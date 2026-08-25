import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema } from './common.js';
import { createPaginatedResponseSchema, paginationQuerySchema } from './pagination.js';

export const paymentProviderSchema = z.enum(['mock', 'alipay', 'wechat']);
export const paymentIntentStatusSchema = z.enum([
  'created',
  'pending',
  'succeeded',
  'closed',
  'failed',
  'partially_refunded',
  'refunded',
]);
export const paymentRefundStatusSchema = z.enum(['pending', 'succeeded', 'failed']);

export const paymentIntentSchema = z.object({
  id: entityIdSchema,
  provider: paymentProviderSchema,
  merchantOrderId: z.string().min(1).max(64),
  providerTransactionId: z.string().max(128).nullable(),
  subject: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  amountMinor: z.number().int().positive(),
  refundedAmountMinor: z.number().int().nonnegative(),
  currency: z.literal('CNY'),
  status: paymentIntentStatusSchema,
  checkoutUrl: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  expiresAt: isoDateTimeSchema,
  paidAt: isoDateTimeSchema.nullable(),
  closedAt: isoDateTimeSchema.nullable(),
  createdBy: entityIdSchema.nullable(),
  lastError: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const paymentRefundSchema = z.object({
  id: entityIdSchema,
  paymentIntentId: entityIdSchema,
  merchantRefundId: z.string().min(1).max(64),
  providerRefundId: z.string().max(128).nullable(),
  amountMinor: z.number().int().positive(),
  reason: z.string().max(300).nullable(),
  status: paymentRefundStatusSchema,
  lastError: z.string().nullable(),
  refundedAt: isoDateTimeSchema.nullable(),
  createdBy: entityIdSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const paymentIntentQuerySchema = paginationQuerySchema.extend({
  provider: paymentProviderSchema.optional(),
  status: paymentIntentStatusSchema.optional(),
  merchantOrderId: z.string().trim().min(1).max(64).optional(),
});

export const paymentRefundQuerySchema = paginationQuerySchema.extend({
  status: paymentRefundStatusSchema.optional(),
  paymentIntentId: entityIdSchema.optional(),
});

export const createPaymentIntentRequestSchema = z.object({
  merchantOrderId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  subject: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  amountMinor: z.number().int().positive().max(100_000_000_000),
  currency: z.literal('CNY').default('CNY'),
  provider: paymentProviderSchema.optional(),
  expiresInSeconds: z.number().int().min(60).max(86_400).default(1_800),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const createPaymentRefundRequestSchema = z.object({
  merchantRefundId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  amountMinor: z.number().int().positive().max(100_000_000_000),
  reason: z.string().trim().max(300).optional(),
});

export const paymentIntentListResponseSchema = createPaginatedResponseSchema(paymentIntentSchema);
export const paymentRefundListResponseSchema = createPaginatedResponseSchema(paymentRefundSchema);
export const paymentIntentResponseSchema = z.object({ intent: paymentIntentSchema });
export const paymentRefundResponseSchema = z.object({ refund: paymentRefundSchema });
export const paymentCallbackResponseSchema = z.object({ accepted: z.literal(true) });

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentIntentStatus = z.infer<typeof paymentIntentStatusSchema>;
export type PaymentRefundStatus = z.infer<typeof paymentRefundStatusSchema>;
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type PaymentRefund = z.infer<typeof paymentRefundSchema>;
export type PaymentIntentQuery = z.output<typeof paymentIntentQuerySchema>;
export type PaymentRefundQuery = z.output<typeof paymentRefundQuerySchema>;
export type CreatePaymentIntentRequest = z.output<typeof createPaymentIntentRequestSchema>;
export type CreatePaymentRefundRequest = z.output<typeof createPaymentRefundRequestSchema>;
