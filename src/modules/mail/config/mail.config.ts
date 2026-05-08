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
  return mailSchema.parse({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
    from: env.MAIL_FROM,
    secure: env.MAIL_SECURE ?? false,
    appUrl: env.APP_URL,
  });
});
