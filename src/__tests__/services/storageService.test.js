// ── Supabase storage mock ─────────────────────────────────────────────────────
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockStorageFrom = jest.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
}));

jest.mock('../../config/supabase', () => ({
  supabase: { storage: { from: (...args) => mockStorageFrom(...args) } },
  isSupabaseConfigured: true,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
}));

// expo-file-system/legacy is auto-mapped via moduleNameMapper in package.json
jest.mock('expo-file-system/legacy');

const FileSystemLegacy = require('expo-file-system/legacy');
const { storageService } = require('../../services/storageService');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPublicUrl.mockReturnValue({
    data: { publicUrl: 'https://cdn.example.com/memorials/mem-1/test.jpg' },
  });
});

// ── uploadFile — not configured ───────────────────────────────────────────────
describe('storageService.uploadFile (not configured)', () => {
  it('returns error immediately', async () => {
    jest.resetModules();
    jest.mock('../../config/supabase', () => ({
      supabase: null,
      isSupabaseConfigured: false,
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
    }));
    jest.mock('expo-file-system/legacy');
    const { storageService: svc } = require('../../services/storageService');

    const result = await svc.uploadFile('file://test.jpg', 'test.jpg', 'folder');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });
});

// ── uploadFile — native URI ───────────────────────────────────────────────────
describe('storageService.uploadFile (native file:// URI)', () => {
  beforeEach(() => {
    // jest-expo defaults Platform.OS to 'ios' in the native test environment
  });

  it('reads file as base64 and uploads successfully', async () => {
    FileSystemLegacy.readAsStringAsync.mockResolvedValue('SGVsbG8='); // base64 "Hello"
    mockUpload.mockResolvedValue({ error: null });

    const result = await storageService.uploadFile('file:///photo.jpg', 'photo.jpg', 'mem-1');

    expect(FileSystemLegacy.readAsStringAsync).toHaveBeenCalledWith(
      'file:///photo.jpg',
      expect.objectContaining({ encoding: expect.any(String) })
    );
    expect(mockUpload).toHaveBeenCalledWith(
      'mem-1/photo.jpg',
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true, contentType: 'image/jpeg' })
    );
    expect(result.success).toBe(true);
    expect(result.path).toBe('mem-1/photo.jpg');
  });

  it('falls back to copyAsync when readAsStringAsync fails on first try', async () => {
    FileSystemLegacy.readAsStringAsync
      .mockRejectedValueOnce(new Error('ph:// not readable directly'))
      .mockResolvedValueOnce('SGVsbG8=');
    FileSystemLegacy.copyAsync.mockResolvedValue(undefined);
    FileSystemLegacy.cacheDirectory = 'file:///cache/';
    mockUpload.mockResolvedValue({ error: null });

    const result = await storageService.uploadFile('ph://asset/photo.jpg', 'photo.jpg', 'mem-1');

    expect(FileSystemLegacy.copyAsync).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('returns error when both read and copy fail', async () => {
    FileSystemLegacy.readAsStringAsync.mockRejectedValue(new Error('read failed'));
    FileSystemLegacy.copyAsync.mockRejectedValue(new Error('copy failed'));

    const result = await storageService.uploadFile('ph://asset/photo.jpg', 'photo.jpg', 'mem-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Could not read file/);
  });

  it('returns error when supabase upload fails', async () => {
    FileSystemLegacy.readAsStringAsync.mockResolvedValue('SGVsbG8=');
    mockUpload.mockResolvedValue({ error: { message: 'Storage quota exceeded' } });

    const result = await storageService.uploadFile('file:///photo.jpg', 'photo.jpg', 'mem-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Storage quota exceeded');
  });

  it('uses correct MIME type for video files', async () => {
    FileSystemLegacy.readAsStringAsync.mockResolvedValue('base64data');
    mockUpload.mockResolvedValue({ error: null });

    await storageService.uploadFile('file:///video.mp4', 'video.mp4', 'mem-1');

    expect(mockUpload).toHaveBeenCalledWith(
      'mem-1/video.mp4',
      expect.anything(),
      expect.objectContaining({ contentType: 'video/mp4' })
    );
  });

  it('uses correct MIME type for audio files', async () => {
    FileSystemLegacy.readAsStringAsync.mockResolvedValue('base64data');
    mockUpload.mockResolvedValue({ error: null });

    await storageService.uploadFile('file:///audio.m4a', 'audio.m4a', 'mem-1');

    expect(mockUpload).toHaveBeenCalledWith(
      'mem-1/audio.m4a',
      expect.anything(),
      expect.objectContaining({ contentType: 'audio/mp4' })
    );
  });

  it('uses octet-stream for unknown extension', async () => {
    FileSystemLegacy.readAsStringAsync.mockResolvedValue('base64data');
    mockUpload.mockResolvedValue({ error: null });

    await storageService.uploadFile('file:///data.xyz', 'data.xyz', 'mem-1');

    expect(mockUpload).toHaveBeenCalledWith(
      'mem-1/data.xyz',
      expect.anything(),
      expect.objectContaining({ contentType: 'application/octet-stream' })
    );
  });

  it('uses default folder "media" when folder not provided', async () => {
    FileSystemLegacy.readAsStringAsync.mockResolvedValue('base64data');
    mockUpload.mockResolvedValue({ error: null });

    await storageService.uploadFile('file:///photo.jpg', 'photo.jpg');

    expect(mockUpload).toHaveBeenCalledWith(
      'media/photo.jpg',
      expect.anything(),
      expect.anything()
    );
  });

  it('handles content:// URIs as native', async () => {
    FileSystemLegacy.readAsStringAsync.mockResolvedValue('base64data');
    mockUpload.mockResolvedValue({ error: null });

    const result = await storageService.uploadFile(
      'content://media/photo.jpg',
      'photo.jpg',
      'mem-1'
    );

    expect(FileSystemLegacy.readAsStringAsync).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

// ── uploadFile — web/remote URI ───────────────────────────────────────────────
describe('storageService.uploadFile (web/remote URL)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('fetches blob and uploads successfully', async () => {
    const mockBlob = { type: 'image/png' };
    global.fetch.mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
    });
    mockUpload.mockResolvedValue({ error: null });

    const result = await storageService.uploadFile(
      'https://example.com/photo.png',
      'photo.png',
      'mem-1'
    );

    expect(global.fetch).toHaveBeenCalledWith('https://example.com/photo.png');
    expect(mockUpload).toHaveBeenCalledWith(
      'mem-1/photo.png',
      mockBlob,
      expect.objectContaining({ contentType: 'image/png' })
    );
    expect(result.success).toBe(true);
  });

  it('returns error when fetch responds with non-ok status', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await storageService.uploadFile(
      'https://example.com/missing.jpg',
      'missing.jpg',
      'mem-1'
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/HTTP 404/);
  });

  it('returns error when fetch throws a network error', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const result = await storageService.uploadFile(
      'https://example.com/photo.jpg',
      'photo.jpg',
      'mem-1'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

// ── getFileURL ────────────────────────────────────────────────────────────────
describe('storageService.getFileURL', () => {
  it('returns the public URL for a storage path', () => {
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/memorials/mem-1/photo.jpg' },
    });

    const result = storageService.getFileURL('mem-1/photo.jpg');

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://cdn.example.com/memorials/mem-1/photo.jpg');
    expect(mockStorageFrom).toHaveBeenCalledWith('memorials');
    expect(mockGetPublicUrl).toHaveBeenCalledWith('mem-1/photo.jpg');
  });
});

// ── deleteFile ────────────────────────────────────────────────────────────────
describe('storageService.deleteFile', () => {
  it('removes the file and returns success', async () => {
    mockRemove.mockResolvedValue({ error: null });

    const result = await storageService.deleteFile('mem-1/photo.jpg');

    expect(result.success).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith(['mem-1/photo.jpg']);
  });

  it('returns error when remove fails', async () => {
    mockRemove.mockResolvedValue({ error: { message: 'File not found' } });

    const result = await storageService.deleteFile('mem-1/missing.jpg');

    expect(result.success).toBe(false);
    expect(result.error).toBe('File not found');
  });
});
