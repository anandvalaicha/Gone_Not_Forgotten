// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockFrom = jest.fn();

jest.mock('../../config/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
  isSupabaseConfigured: true,
}));

const { memorialService } = require('../../services/memorialService');

// ── Chainable query builder helper ────────────────────────────────────────────
const makeChain = (overrides = {}) => {
  const chain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn(),
    ...overrides,
  };
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createMemorial ────────────────────────────────────────────────────────────
describe('memorialService.createMemorial', () => {
  it('inserts memorial and returns new id on success', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: { id: 'mem-001' }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.createMemorial('user-1', {
      title: 'Grandma',
      description: 'Loved by all',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('mem-001');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', title: 'Grandma' })
    );
  });

  it('returns error when insert fails', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.createMemorial('user-1', { title: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
  });
});

// ── getUserMemorials ──────────────────────────────────────────────────────────
describe('memorialService.getUserMemorials', () => {
  it('returns list of memorials for a user', async () => {
    const memorials = [{ id: 'm1', title: 'A' }, { id: 'm2', title: 'B' }];
    const chain = makeChain();
    chain.order.mockResolvedValue({ data: memorials, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.getUserMemorials('user-1');

    expect(result.success).toBe(true);
    expect(result.memorials).toHaveLength(2);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('returns error when query fails', async () => {
    const chain = makeChain();
    chain.order.mockResolvedValue({ data: null, error: { message: 'Query failed' } });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.getUserMemorials('user-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Query failed');
  });
});

// ── getMemorial ───────────────────────────────────────────────────────────────
describe('memorialService.getMemorial', () => {
  it('fetches a single memorial by id', async () => {
    const memorial = { id: 'mem-001', title: 'Grandpa' };
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: memorial, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.getMemorial('mem-001');

    expect(result.success).toBe(true);
    expect(result.memorial.id).toBe('mem-001');
    expect(chain.eq).toHaveBeenCalledWith('id', 'mem-001');
  });

  it('returns error when memorial not found', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.getMemorial('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});

// ── updateMemorial ────────────────────────────────────────────────────────────
describe('memorialService.updateMemorial', () => {
  it('updates a memorial and returns success', async () => {
    const chain = makeChain();
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.updateMemorial('mem-001', { title: 'Updated Title' });

    expect(result.success).toBe(true);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title', updated_at: expect.any(String) })
    );
  });

  it('returns error when update fails', async () => {
    const chain = makeChain();
    chain.eq.mockResolvedValue({ error: { message: 'Permission denied' } });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.updateMemorial('mem-001', { title: 'X' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });
});

// ── appendMedia ───────────────────────────────────────────────────────────────
describe('memorialService.appendMedia', () => {
  it('appends a media URL to the existing array', async () => {
    const fetchChain = makeChain();
    fetchChain.single.mockResolvedValue({ data: { photos: ['url1'] }, error: null });

    const updateChain = makeChain();
    updateChain.eq.mockResolvedValue({ error: null });

    // First call (select) returns fetchChain, second call (update) returns updateChain
    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(updateChain);

    const result = await memorialService.appendMedia('mem-001', 'photos', 'url2');

    expect(result.success).toBe(true);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ photos: ['url1', 'url2'] })
    );
  });

  it('handles empty existing array', async () => {
    const fetchChain = makeChain();
    fetchChain.single.mockResolvedValue({ data: { photos: null }, error: null });

    const updateChain = makeChain();
    updateChain.eq.mockResolvedValue({ error: null });

    mockFrom.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

    const result = await memorialService.appendMedia('mem-001', 'photos', 'url1');

    expect(result.success).toBe(true);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ photos: ['url1'] })
    );
  });

  it('returns error when fetch fails', async () => {
    const fetchChain = makeChain();
    fetchChain.single.mockResolvedValue({ data: null, error: { message: 'Fetch failed' } });
    mockFrom.mockReturnValue(fetchChain);

    const result = await memorialService.appendMedia('mem-001', 'photos', 'url1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Fetch failed');
  });
});

// ── deleteMemorial ────────────────────────────────────────────────────────────
describe('memorialService.deleteMemorial', () => {
  it('deletes a memorial and returns success', async () => {
    const chain = makeChain();
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.deleteMemorial('mem-001');

    expect(result.success).toBe(true);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'mem-001');
  });

  it('returns error when delete fails', async () => {
    const chain = makeChain();
    chain.eq.mockResolvedValue({ error: { message: 'Foreign key violation' } });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.deleteMemorial('mem-001');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Foreign key violation');
  });
});

// ── savePlaquePost ──────────────────────────────────────────────────────────────
describe('memorialService.savePlaquePost', () => {
  it('upserts a plaque post and returns success', async () => {
    const chain = makeChain();
    chain.upsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.savePlaquePost('plaque-1', 'user-1', {
      description: 'A memory',
      photos: ['photo1.jpg'],
      videos: [],
      audios: [],
    });

    expect(result.success).toBe(true);
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'plaque-1', user_id: 'user-1', description: 'A memory' }),
      { onConflict: 'id' }
    );
  });

  it('defaults null description to null in DB', async () => {
    const chain = makeChain();
    chain.upsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await memorialService.savePlaquePost('plaque-2', 'user-1', { photos: [], videos: [], audios: [] });

    const callArgs = chain.upsert.mock.calls[0][0];
    expect(callArgs.description).toBeNull();
  });

  it('returns error when upsert fails', async () => {
    const chain = makeChain();
    chain.upsert.mockResolvedValue({ error: { message: 'Upsert error' } });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.savePlaquePost('plaque-1', 'user-1', {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('Upsert error');
  });
});

// ── getPlaquePost ───────────────────────────────────────────────────────────────
describe('memorialService.getPlaquePost', () => {
  it('fetches a plaque post by id', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({
      data: { id: 'plaque-1', description: 'Hi', photos: [] },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.getPlaquePost('plaque-1');

    expect(result.success).toBe(true);
    expect(result.plaquePost.id).toBe('plaque-1');
  });

  it('returns error when not found', async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    mockFrom.mockReturnValue(chain);

    const result = await memorialService.getPlaquePost('nonexistent');

    expect(result.success).toBe(false);
  });
});

// ── getPublicProfile ──────────────────────────────────────────────────────────
describe('memorialService.getPublicProfile', () => {
  it('returns profile with display name and memorials', async () => {
    const profileChain = makeChain();
    profileChain.single.mockResolvedValue({
      data: { display_name: 'Jane Doe', bio: 'A bio', photo_url: 'photo.jpg' },
      error: null,
    });

    const memorialsChain = makeChain();
    memorialsChain.order.mockResolvedValue({
      data: [
        {
          id: 'm1',
          title: 'Memorial 1',
          description: 'Desc',
          created_at: '2024-01-01T00:00:00Z',
          photos: ['p1.jpg'],
          videos: [],
          audios: [],
        },
      ],
      error: null,
    });

    mockFrom.mockReturnValueOnce(profileChain).mockReturnValueOnce(memorialsChain);

    const result = await memorialService.getPublicProfile('user-1');

    expect(result.success).toBe(true);
    expect(result.profile.displayName).toBe('Jane Doe');
    expect(result.profile.bio).toBe('A bio');
    expect(result.profile.memorials).toHaveLength(1);
    expect(result.profile.memorials[0].photos).toEqual(['p1.jpg']);
    expect(result.profile.memorials[0].createdAt).toBeInstanceOf(Date);
  });

  it('falls back to first_name + last_name when display_name missing', async () => {
    const profileChain = makeChain();
    profileChain.single.mockResolvedValue({
      data: { first_name: 'John', last_name: 'Smith', bio: '' },
      error: null,
    });

    const memorialsChain = makeChain();
    memorialsChain.order.mockResolvedValue({ data: [], error: null });

    mockFrom.mockReturnValueOnce(profileChain).mockReturnValueOnce(memorialsChain);

    const result = await memorialService.getPublicProfile('user-1');

    expect(result.profile.displayName).toBe('John Smith');
  });

  it('falls back to "User" when no name data available', async () => {
    const profileChain = makeChain();
    profileChain.single.mockResolvedValue({ data: {}, error: null });

    const memorialsChain = makeChain();
    memorialsChain.order.mockResolvedValue({ data: [], error: null });

    mockFrom.mockReturnValueOnce(profileChain).mockReturnValueOnce(memorialsChain);

    const result = await memorialService.getPublicProfile('user-1');

    expect(result.profile.displayName).toBe('User');
  });

  it('still returns success when profile row is missing', async () => {
    const profileChain = makeChain();
    profileChain.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const memorialsChain = makeChain();
    memorialsChain.order.mockResolvedValue({ data: [], error: null });

    mockFrom.mockReturnValueOnce(profileChain).mockReturnValueOnce(memorialsChain);

    const result = await memorialService.getPublicProfile('user-1');

    expect(result.success).toBe(true);
    expect(result.profile.displayName).toBe('User');
  });
});
