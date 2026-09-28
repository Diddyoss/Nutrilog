import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Fake Supabase: each test sets who the token belongs to and how many
// analyses they've already used.
const db = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  count: 0,
  countError: null as { code: string; message: string } | null,
  inserted: 0,
  since: '' as string,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () =>
        db.userId
          ? { data: { user: { id: db.userId } }, error: null }
          : { data: { user: null }, error: { message: 'invalid JWT' } },
    },
    from: () => ({
      select: () => ({
        gte: (_col: string, since: string) => {
          db.since = since;
          return {
            limit: async () =>
              db.countError ? { count: null, error: db.countError } : { count: db.count, error: null },
          };
        },
      }),
      insert: async () => {
        db.inserted++;
        return { error: null };
      },
    }),
  }),
}));

import handler, {
  authorizePhotoAnalysis,
  bearerToken,
  dailyLimitFrom,
  DEFAULT_DAILY_LIMIT,
  type AccessDeps,
} from '../analyze-food';

// ---------------------------------------------------------------------------
// Pure access logic
// ---------------------------------------------------------------------------

describe('bearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme', () => {
    expect(bearerToken('bearer tok')).toBe('tok');
  });

  it('returns null for missing, empty or non-Bearer headers', () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('uses the first value when the header is repeated', () => {
    expect(bearerToken(['Bearer first', 'Bearer second'])).toBe('first');
  });
});

describe('dailyLimitFrom', () => {
  it('parses a positive integer', () => {
    expect(dailyLimitFrom('50')).toBe(50);
  });

  it('falls back to the default for missing, zero, negative or junk values', () => {
    for (const v of [undefined, '', '0', '-5', 'lots']) expect(dailyLimitFrom(v)).toBe(DEFAULT_DAILY_LIMIT);
  });
});

describe('authorizePhotoAnalysis', () => {
  function fakeDeps(overrides: Partial<AccessDeps> = {}): AccessDeps & { recorded: number } {
    const deps = {
      recorded: 0,
      getUserId: async () => 'user-1',
      countSince: async () => 0 as number | 'no-table',
      record: async () => {
        deps.recorded++;
      },
      ...overrides,
    };
    return deps;
  }

  it('rejects a missing token with 401 without touching the database', async () => {
    const getUserId = vi.fn();
    const r = await authorizePhotoAnalysis(null, fakeDeps({ getUserId }), 30);
    expect(r).toEqual({ ok: false, status: 401, error: 'Sign-in required' });
    expect(getUserId).not.toHaveBeenCalled();
  });

  it('rejects an invalid token with 401', async () => {
    const r = await authorizePhotoAnalysis('bad', fakeDeps({ getUserId: async () => null }), 30);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('allows and records usage while under the limit', async () => {
    const deps = fakeDeps({ countSince: async () => 29 });
    expect(await authorizePhotoAnalysis('tok', deps, 30)).toEqual({ ok: true, userId: 'user-1' });
    expect(deps.recorded).toBe(1);
  });

  it('rejects with 429 at the limit and records nothing', async () => {
    const deps = fakeDeps({ countSince: async () => 30 });
    const r = await authorizePhotoAnalysis('tok', deps, 30);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.error).toContain('30 per 24h');
    }
    expect(deps.recorded).toBe(0);
  });

  it('counts over a rolling 24h window', async () => {
    const countSince = vi.fn(async () => 0);
    await authorizePhotoAnalysis('tok', fakeDeps({ countSince }), 30, new Date('2026-09-28T12:00:00Z'));
    expect(countSince).toHaveBeenCalledWith('2026-09-27T12:00:00.000Z');
  });

  it('fails open (but stays authenticated) before migration 006 is run', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = fakeDeps({ countSince: async () => 'no-table' });
    expect(await authorizePhotoAnalysis('tok', deps, 30)).toEqual({ ok: true, userId: 'user-1' });
    expect(deps.recorded).toBe(0);
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Handler, end to end with Supabase and OpenRouter mocked
// ---------------------------------------------------------------------------

function mockRes() {
  const res = { statusCode: 0, body: undefined as unknown };
  const api = {
    status(code: number) {
      res.statusCode = code;
      return api;
    },
    json(body: unknown) {
      res.body = body;
      return api;
    },
  };
  return { res, api: api as unknown as VercelResponse };
}

function request(authorization?: string, body: unknown = { image: 'aGVsbG8=' }): VercelRequest {
  return {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body,
  } as unknown as VercelRequest;
}

function aiReply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

async function call(req: VercelRequest) {
  const { res, api } = mockRes();
  await handler(req, api);
  return res;
}

describe('analyze-food handler', () => {
  const fetchMock = vi.fn();
  const ENV_KEYS = ['OPENROUTER_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'AI_DAILY_LIMIT'];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon';
    delete process.env.AI_DAILY_LIMIT;
    Object.assign(db, { userId: 'user-1', count: 0, countError: null, inserted: 0, since: '' });
    fetchMock.mockReset().mockResolvedValue(aiReply('{"food_name":"Toast","calories":120}'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('401s without an Authorization header and never calls the AI', async () => {
    const res = await call(request());
    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401s for an invalid session and never calls the AI', async () => {
    db.userId = null;
    const res = await call(request('Bearer forged'));
    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('analyses the photo and records usage for a valid session', async () => {
    const res = await call(request('Bearer good'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ food_name: 'Toast', calories: 120 });
    expect(db.inserted).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('429s once the default daily limit is used, without calling the AI', async () => {
    db.count = DEFAULT_DAILY_LIMIT;
    const res = await call(request('Bearer good'));
    expect(res.statusCode).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.inserted).toBe(0);
  });

  it('respects AI_DAILY_LIMIT', async () => {
    process.env.AI_DAILY_LIMIT = '2';
    db.count = 2;
    expect((await call(request('Bearer good'))).statusCode).toBe(429);
    db.count = 1;
    expect((await call(request('Bearer good'))).statusCode).toBe(200);
  });

  it('still works (authenticated, unlimited) before migration 006', async () => {
    db.countError = { code: 'PGRST205', message: "Could not find the table 'public.ai_usage'" };
    const res = await call(request('Bearer good'));
    expect(res.statusCode).toBe(200);
    expect(db.inserted).toBe(0);
  });

  it('503s rather than allowing when the usage check fails for another reason', async () => {
    db.countError = { code: '57014', message: 'statement timeout' };
    const res = await call(request('Bearer good'));
    expect(res.statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when Supabase is not configured on the server', async () => {
    delete process.env.VITE_SUPABASE_URL;
    const res = await call(request('Bearer good'));
    expect(res.statusCode).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not leak upstream error details to the client', async () => {
    fetchMock.mockResolvedValue(new Response('provider secret detail', { status: 500 }));
    const res = await call(request('Bearer good'));
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'AI analysis failed — try again' });
  });

  it('does not echo an unparseable AI reply to the client', async () => {
    fetchMock.mockResolvedValue(aiReply('Sorry, I cannot help with that.'));
    const res = await call(request('Bearer good'));
    expect(res.statusCode).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain('Sorry');
  });

  it('checks the method and image before any auth work', async () => {
    const get = { ...request('Bearer good'), method: 'GET' } as VercelRequest;
    expect((await call(get)).statusCode).toBe(405);
    expect((await call(request('Bearer good', {}))).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
