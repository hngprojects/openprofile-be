import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const mailSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(587),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().min(1),
  secure: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(false)
    .transform((value) => value === true || value === 'true'),
  appUrl: z.string().url(),
});

export type MailConfig = z.infer<typeof mailSchema>;

export const mailConfig = registerAs('mail', (): MailConfig => {
  return mailSchema.parse({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
    secure: process.env.MAIL_SECURE,
    appUrl: process.env.APP_URL,
  });
});
