# Open Profile BE

A production-ready NestJS 11 starter with PostgreSQL, JWT auth, the repository pattern via [`@hng-sdk/orm`](https://www.npmjs.com/package/@hng-sdk/orm), and migrations out of the box.

## Stack

- **Runtime**: NestJS 11 + TypeScript 5
- **Database**: PostgreSQL via TypeORM (accessed through `@hng-sdk/orm`'s `AbstractModelAction` repository pattern)
- **Auth**: JWT access + refresh tokens (`@nestjs/jwt` + Passport)
- **Validation**: `class-validator` + `class-transformer` for HTTP DTOs
- **Env validation**: [`@t3-oss/env-core`](https://env.t3.gg) + Zod (fail-fast on missing/invalid env vars)
- **Docs**: Swagger at `/docs`
- **Hardening**: Helmet, compression, CORS, global exception filter, response envelope

## Prerequisites

- Node.js 20+
- npm (or pnpm/yarn — adjust commands accordingly)
- A running PostgreSQL 14+ instance

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# edit .env with your DB credentials and at least 32-char JWT secrets

# 3. Create the database (one-time)
createdb nestjs_starter   # or your preferred client

# 4. Apply migrations
npm run migration:run

# 5. (optional) Seed an admin user
npm run seed
# creates admin@example.com / Admin@123456

# 6. Run
npm run start:dev
```

Open `http://localhost:3000/docs` for the Swagger UI.

## Scripts

### App

| Script                | Purpose                         |
| --------------------- | ------------------------------- |
| `npm run start:dev`   | Run with watch mode             |
| `npm run start:debug` | Run with `--inspect` debugger   |
| `npm run start:prod`  | Run the compiled `dist/main.js` |
| `npm run build`       | Compile to `dist/`              |
| `npm run lint`        | Lint and auto-fix               |
| `npm run format`      | Prettier                        |
| `npm run test`        | Unit tests                      |
| `npm run test:e2e`    | End-to-end tests                |
| `npm run test:cov`    | Coverage report                 |

### Database

| Script                                                      | Purpose                                      |
| ----------------------------------------------------------- | -------------------------------------------- |
| `npm run migration:run`                                     | Apply all pending migrations                 |
| `npm run migration:revert`                                  | Revert the most recent migration             |
| `npm run migration:show`                                    | List migrations and their status             |
| `npm run migration:generate src/database/migrations/<Name>` | Diff entities vs DB and generate a migration |
| `npm run migration:create src/database/migrations/<Name>`   | Create an empty migration                    |
| `npm run schema:drop`                                       | Drop all tables (destructive — dev only)     |
| `npm run seed`                                              | Run all seeders                              |
| `npm run db:reset`                                          | Drop schema, run migrations, run seeders     |

> The `migration:generate` script requires a live database connection so TypeORM can diff against the current schema.

## Folder structure

```
src/
├── common/                 # cross-cutting: decorators, filters, interceptors
│   ├── decorators/         # @Public(), @CurrentUser()
│   ├── filters/            # global HttpExceptionFilter
│   └── interceptors/       # logging + response envelope
├── config/                 # env (t3-env), app/database/jwt config
├── database/
│   ├── data-source.ts      # TypeORM CLI DataSource
│   ├── migrations/
│   └── seeds/
├── modules/
│   ├── auth/               # /auth/register, /login, /refresh, /logout, /me
│   ├── health/             # /health (public)
│   ├── mail/               # nodemailer sender + queue worker for emails
│   ├── queue/              # BullMQ root config + shared queue service
│   └── users/              # CRUD example using the repository pattern
│       ├── actions/        # UserModelAction extends AbstractModelAction<User>
│       ├── dto/
│       └── entities/
├── app.module.ts
└── main.ts
```

## Architecture

### Repository pattern via `@hng-sdk/orm`

Services never depend on TypeORM `Repository<T>` directly. Instead, each entity gets a `*ModelAction` class that extends `AbstractModelAction<T>` and exposes a uniform CRUD API (`create`, `get`, `find`, `list`, `update`, `delete`, `save`) plus any domain-specific helpers.

```ts
// modules/users/actions/user.action.ts
@Injectable()
export class UserModelAction extends AbstractModelAction<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository, User);
  }

  findByEmail(email: string) {
    return this.get({ identifierOptions: { email } });
  }
}
```

```ts
// modules/users/users.service.ts
@Injectable()
export class UsersService {
  constructor(private readonly userModelAction: UserModelAction) {}

  findOne(id: string) {
    return this.userModelAction.get({ identifierOptions: { id } });
  }
}
```

### Adding a new module

1. Create `src/modules/<name>/`
2. Define the entity in `entities/<name>.entity.ts`
3. Create the model action in `actions/<name>.action.ts`
4. Implement service and controller
5. Wire up the module: `imports: [TypeOrmModule.forFeature([Entity])]`, providers include the model action
6. Register the module in `AppModule.imports`
7. Generate a migration: `npm run migration:generate src/database/migrations/Add<Name>`
8. Apply it: `npm run migration:run`

### Env validation

`src/config/env.ts` uses `@t3-oss/env-core` with Zod. The app fails to boot with a readable error if any required variable is missing or invalid. Import the typed `env` object instead of reaching into `process.env`:

```ts
import { env } from './config/env';
const port = env.PORT; // typed as number
```

### Auth flow

| Endpoint         | Method | Auth   | Purpose                                         |
| ---------------- | ------ | ------ | ----------------------------------------------- |
| `/auth/register` | POST   | public | Create account, returns access + refresh tokens |
| `/auth/login`    | POST   | public | Returns access + refresh tokens                 |
| `/auth/refresh`  | POST   | public | Issue a new access token from a refresh token   |
| `/auth/logout`   | POST   | bearer | Revoke the current refresh token                |
| `/auth/me`       | GET    | bearer | Return current user                             |

The global `JwtAuthGuard` protects every route by default. Decorate handlers (or controllers) with `@Public()` to opt out.

### Queue-to-mail flow

This project uses BullMQ as the background job layer and Nodemailer as the mail sender:

1. A service such as `AuthService` creates a payload for the email job.
2. The service calls `QueueService.addJob(...)` with `QUEUE_NAMES.EMAIL` and `QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_RESET`.
3. BullMQ stores the job in Redis using the settings from `src/modules/queue/config/bull.config.ts`.
4. `MailProcessor` consumes the job and hands the payload to `MailService`.
5. `MailService` sends the actual email through Nodemailer.

Example enqueue call from a domain service:

```ts
await this.queueService.addJob(
  QUEUE_NAMES.EMAIL,
  QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_RESET,
  {
    to: user.email,
    resetLink: `${env.APP_URL}/reset-password?token=${rawToken}`,
  },
  {
    jobId: `user-${user.id}`,
  },
);
```

Example processor behavior:

```ts
@Processor(QUEUE_NAMES.EMAIL)
export class MailProcessor extends WorkerHost {
  async process(job: Job) {
    switch (job.name) {
      case QUEUE_JOB_NAMES.EMAIL.SEND_PASSWORD_RESET:
        await this.mailService.sendEmail(
          job.data.to,
          'Password Reset Request',
          resetPasswordEmailTemplate({ resetUrl: job.data.resetLink }),
        );
        break;
    }
  }
}
```

Example mail sender behavior:

```ts
await this.transporter.sendMail({
  from: env.MAIL_FROM,
  to,
  subject,
  html,
});
```

Required env vars for mail:

- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`
- `APP_URL`
- `REDIS_URL`

Recommended responsibilities:

- `QueueModule`: registers BullMQ once and owns Redis connection defaults.
- `MailModule`: owns mail config, the Nodemailer sender, and the worker processor.
- `AuthService` or any domain service: enqueues the email job.
- `MailProcessor`: turns the queued job into a sent email.

### Response envelope

`TransformInterceptor` wraps successful responses:

```json
{
  "success": true,
  "data": { ... }
}
```

For paginated responses, `paginationMeta` from `@hng-sdk/orm` is hoisted into `meta`.

Errors go through `HttpExceptionFilter`:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": ["email must be an email"],
  "path": "/api/users",
  "timestamp": "2026-04-28T12:34:56.000Z"
}
```

## Environment variables

See `.env.example` for the full list. Critical ones:

| Variable             | Notes                                                      |
| -------------------- | ---------------------------------------------------------- |
| `DATABASE_*`         | host/port/user/password/name                               |
| `DATABASE_SYNC`      | **Always `false` in non-dev** — use migrations             |
| `DATABASE_SSL`       | `true` for managed providers (Neon, Supabase, RDS)         |
| `JWT_ACCESS_SECRET`  | Min 32 chars                                               |
| `JWT_REFRESH_SECRET` | Min 32 chars, must differ from access secret               |
| `SWAGGER_ENABLED`    | Set to `false` in production if you don't want public docs |
| `MAIL_HOST`          | SMTP host used by Nodemailer                               |
| `MAIL_PORT`          | SMTP port, usually `587` or `465`                          |
| `MAIL_USER`          | SMTP username                                              |
| `MAIL_PASS`          | SMTP password                                              |
| `MAIL_FROM`          | Default sender address                                     |
| `APP_URL`            | Used to build password reset links                         |
| `REDIS_URL`          | Redis connection string used by BullMQ                     |

## License

UNLICENSED
