import { z } from 'zod';

import { entityIdSchema, isoDateTimeSchema } from './common.js';

export const emailAddressSchema = z.string().trim().toLowerCase().pipe(z.email().max(320));
export const passwordSchema = z.string().min(12).max(128);
export const identityStatusSchema = z.enum(['active', 'disabled']);

export const identityUserSchema = z.object({
  id: entityIdSchema,
  email: emailAddressSchema,
  displayName: z.string().min(1).max(120).nullable(),
  status: identityStatusSchema,
  emailVerifiedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const loginRequestSchema = z.object({
  email: emailAddressSchema,
  password: z.string().min(1).max(128),
});

export const sessionIdentitySchema = z.object({
  user: identityUserSchema,
  session: z.object({ expiresAt: isoDateTimeSchema }),
  csrfToken: z.string().min(32),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const requestPasswordResetSchema = z.object({ email: emailAddressSchema });
export const confirmPasswordResetSchema = z.object({
  token: z.string().min(32).max(200),
  newPassword: passwordSchema,
});
export const confirmEmailVerificationSchema = z.object({ token: z.string().min(32).max(200) });
export const acceptedActionSchema = z.object({
  accepted: z.literal(true),
  testToken: z.string().optional(),
});

export type IdentityUser = z.infer<typeof identityUserSchema>;
export type SessionIdentity = z.infer<typeof sessionIdentitySchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type ConfirmPasswordReset = z.infer<typeof confirmPasswordResetSchema>;
