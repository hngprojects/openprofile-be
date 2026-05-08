import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { env } from '../../../config/env';

const mailSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().min(1),
  secure: z.boolean(),
  appUrl: z.string().url(),
});

export type MailConfig = z.infer<typeof mailSchema>;

export const mailConfig = registerAs('mail', (): MailConfig => {
  const isTest = env.NODE_ENV === 'test';
  return mailSchema.parse({
    host: env.MAIL_HOST ?? (isTest ? 'localhost' : undefined),
    port: env.MAIL_PORT,
    user: env.MAIL_USER ?? (isTest ? 'test' : undefined),
    pass: env.MAIL_PASS ?? (isTest ? 'test' : undefined),
    from: env.MAIL_FROM ?? (isTest ? 'test@test.com' : undefined),
    secure: env.MAIL_SECURE ?? false,
    appUrl: env.APP_URL ?? (isTest ? 'http://localhost' : undefined),
  });
});
