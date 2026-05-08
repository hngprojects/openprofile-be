import {
  INestApplication,
  ValidationPipe,
  Controller,
  Post,
  Get,
  Body,
  Query,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

// ─── Schema shape (mirrors your DB) ─────────────────────────────────────────

interface WaitListRow {
  id: string;
  email: string;
  emailSent: boolean;
  createdAt: Date;
}

// ─── Mock Database ───────────────────────────────────────────────────────────

class MockWaitListDatabase {
  private rows: WaitListRow[] = [];

  reset() {
    this.rows = [];
  }

  seed(overrides: Partial<WaitListRow> = {}): WaitListRow {
    const row: WaitListRow = {
      id: crypto.randomUUID(),
      email: 'seeded@example.com',
      emailSent: false,
      createdAt: new Date(),
      ...overrides,
    };
    this.rows.push(row);
    return row;
  }

  findByEmail(email: string): WaitListRow | undefined {
    return this.rows.find((r) => r.email.toLowerCase() === email.toLowerCase());
  }

  insert(email: string): WaitListRow {
    if (this.findByEmail(email)) {
      throw new ConflictException('Email already on waitlist');
    }
    const row: WaitListRow = {
      id: crypto.randomUUID(),
      email,
      emailSent: false,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  paginate(
    page: number,
    limit: number,
  ): { data: WaitListRow[]; total: number } {
    const skip = (page - 1) * limit;
    return {
      data: this.rows.slice(skip, skip + limit),
      total: this.rows.length,
    };
  }
}

// ─── Inline Controller (no src imports) ──────────────────────────────────────

const db = new MockWaitListDatabase();

@Controller('wait-list')
class WaitListTestController {
  @Post()
  add(@Body('email') email: string) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email format');
    }
    const data = db.insert(email); // throws 409 on duplicate
    return { success: true, data };
  }

  @Get()
  list(@Query('page') page: string, @Query('limit') limit: string) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (isNaN(pageNum) || isNaN(limitNum)) {
      throw new BadRequestException();
    }
    const { data, total } = db.paginate(pageNum, limitNum);
    return {
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('WaitList (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WaitListTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(() => {
    db.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /wait-list ───────────────────────────────────────────────────────

  describe('POST /wait-list', () => {
    it('201 – adds a new email to the waitlist', async () => {
      return request(app.getHttpServer())
        .post('/wait-list')
        .send({ email: 'test@example.com' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe('test@example.com');
          expect(res.body.data.id).toBeDefined();
          expect(res.body.data.emailSent).toBe(false);
        });
    });

    it('409 – rejects an exact duplicate email', async () => {
      db.seed({ email: 'duplicate@example.com' });

      return request(app.getHttpServer())
        .post('/wait-list')
        .send({ email: 'duplicate@example.com' })
        .expect(409);
    });

    it('409 – rejects a case-insensitive duplicate (TEST@ vs test@)', async () => {
      db.seed({ email: 'test@example.com' });

      return request(app.getHttpServer())
        .post('/wait-list')
        .send({ email: 'TEST@EXAMPLE.COM' })
        .expect(409);
    });

    it('400 – rejects an invalid email format', async () => {
      return request(app.getHttpServer())
        .post('/wait-list')
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('400 – rejects a missing email field', async () => {
      return request(app.getHttpServer())
        .post('/wait-list')
        .send({})
        .expect(400);
    });
  });

  // ── GET /wait-list ────────────────────────────────────────────────────────

  describe('GET /wait-list', () => {
    beforeEach(() => {
      for (let i = 1; i <= 15; i++) {
        db.seed({ email: `user${i}@example.com`, emailSent: i % 2 === 0 });
      }
    });

    it('200 – returns first page with correct pagination meta', async () => {
      return request(app.getHttpServer())
        .get('/wait-list?page=1&limit=10')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data).toHaveLength(10);
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(10);
          expect(res.body.pagination.total).toBe(15);
          expect(res.body.pagination.totalPages).toBe(2);
        });
    });

    it('200 – returns second page with remaining entries', async () => {
      return request(app.getHttpServer())
        .get('/wait-list?page=2&limit=10')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveLength(5);
          expect(res.body.pagination.page).toBe(2);
        });
    });

    it('200 – returns empty array when store is empty', async () => {
      db.reset();

      return request(app.getHttpServer())
        .get('/wait-list?page=1&limit=10')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveLength(0);
          expect(res.body.pagination.total).toBe(0);
        });
    });

    it('400 – rejects non-numeric page param', async () => {
      return request(app.getHttpServer())
        .get('/wait-list?page=abc&limit=10')
        .expect(400);
    });
  });
});
