import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  // refresh token comes from HttpOnly cookie, not body
});

export const ForgotPasswordSchema = z.object({
  mobile_number: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

export const VerifyOtpSchema = z.object({
  mobile_number: z.string().regex(/^[6-9]\d{9}$/),
  otp: z.string().length(6),
});

export const ResetPasswordSchema = z.object({
  mobile_number: z.string().regex(/^[6-9]\d{9}$/),
  otp: z.string().length(6),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
