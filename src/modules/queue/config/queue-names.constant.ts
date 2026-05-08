import { Verify } from 'node:crypto';

export const QUEUE_NAMES = {
  EMAIL: 'email',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_JOB_NAMES = {
  EMAIL: {
    SEND_PASSWORD_RESET: 'send-password-reset',
    VERIFY_EMAIL: 'verify-email',
  },
} as const;

export type QueueJobName =
  (typeof QUEUE_JOB_NAMES)[keyof typeof QUEUE_JOB_NAMES][keyof (typeof QUEUE_JOB_NAMES)[keyof typeof QUEUE_JOB_NAMES]];
