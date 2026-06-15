// Service for settings.test operations

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const { settingsService } = require('../../services/settingsService');

const DEFAULT_KEY = 'gonenotforgotten-settings';

const defaultSettings = {
  // Privacy & Visibility
  publicProfileEnabled: false,
  showLifeDates: true,
  allowContributions: false,
  // Notifications
  notificationsEnabled: true,
  anniversaryReminders: true,
  visitorAlerts: true,
  dailySummaryEnabled: true,
  // Plaque QR Access
  qrAccess: { profile: true, memories: true, gallery: true, audio: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── getDefaultSettings ────────────────────────────────────────────────────────
describe('settingsService.getDefaultSettings', () => {
  it('returns the correct default settings shape', () => {
    const defaults = settingsService.getDefaultSettings();
    expect(defaults).toEqual(defaultSettings);
  });

  it('includes qrAccess sub-object with expected keys', () => {
    const { qrAccess } = settingsService.getDefaultSettings();
    expect(qrAccess).toHaveProperty('profile', true);
    expect(qrAccess).toHaveProperty('memories', true);
    expect(qrAccess).toHaveProperty('gallery', true);
    expect(qrAccess).toHaveProperty('audio', false);
  });
});

// ── loadSettings ──────────────────────────────────────────────────────────────
describe('settingsService.loadSettings', () => {
  it('returns defaults when nothing is stored', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const result = await settingsService.loadSettings();

    expect(result).toEqual(defaultSettings);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(DEFAULT_KEY);
  });

  it('returns stored settings merged with defaults', async () => {
    const stored = { notificationsEnabled: false, qrAccess: { audio: true } };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const result = await settingsService.loadSettings();

    expect(result.notificationsEnabled).toBe(false);
    // default values preserved when not overridden
    expect(result.publicProfileEnabled).toBe(false);
    expect(result.dailySummaryEnabled).toBe(true);
    // qrAccess is deep-merged
    expect(result.qrAccess.audio).toBe(true);
    expect(result.qrAccess.profile).toBe(true);
  });

  it('deep merges qrAccess with defaults', async () => {
    const stored = { qrAccess: { gallery: false } };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

    const result = await settingsService.loadSettings();

    expect(result.qrAccess.gallery).toBe(false);
    expect(result.qrAccess.profile).toBe(true);   // default preserved
    expect(result.qrAccess.memories).toBe(true);  // default preserved
    expect(result.qrAccess.audio).toBe(false);    // default preserved
  });

  it('returns defaults when stored JSON is invalid', async () => {
    AsyncStorage.getItem.mockResolvedValue('not valid json {{{');

    const result = await settingsService.loadSettings();

    expect(result).toEqual(defaultSettings);
  });

  it('returns defaults when AsyncStorage.getItem throws', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('Storage unavailable'));

    const result = await settingsService.loadSettings();

    expect(result).toEqual(defaultSettings);
  });
});

// ── saveSettings ──────────────────────────────────────────────────────────────
describe('settingsService.saveSettings', () => {
  it('serializes and stores settings successfully', async () => {
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const settings = { ...defaultSettings, notificationsEnabled: false };
    const result = await settingsService.saveSettings(settings);

    expect(result.success).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(DEFAULT_KEY, JSON.stringify(settings));
  });

  it('returns failure when AsyncStorage.setItem throws', async () => {
    AsyncStorage.setItem.mockRejectedValue(new Error('Disk full'));

    const result = await settingsService.saveSettings(defaultSettings);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Disk full');
  });
});

// ── updateSetting ─────────────────────────────────────────────────────────────
describe('settingsService.updateSetting', () => {
  it('loads current settings, updates the key, and saves', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(defaultSettings));
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const result = await settingsService.updateSetting('notificationsEnabled', false);

    expect(result.success).toBe(true);
    const savedArg = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(savedArg.notificationsEnabled).toBe(false);
    // Other keys should remain unchanged
    expect(savedArg.publicProfileEnabled).toBe(defaultSettings.publicProfileEnabled);
  });

  it('can update nested qrAccess as a whole value', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(defaultSettings));
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const newQrAccess = { profile: false, memories: false, gallery: true, audio: true };
    await settingsService.updateSetting('qrAccess', newQrAccess);

    const savedArg = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
    expect(savedArg.qrAccess).toEqual(newQrAccess);
  });

  it('propagates save failure', async () => {
    AsyncStorage.getItem.mockResolvedValue(null); // returns defaults
    AsyncStorage.setItem.mockRejectedValue(new Error('Write failed'));

    const result = await settingsService.updateSetting('dailySummaryEnabled', false);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Write failed');
  });
});
