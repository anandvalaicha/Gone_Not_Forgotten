import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'gonenotforgotten-settings';

const defaultSettings = {
  notificationsEnabled: true,
  publicProfileEnabled: false,
  dailySummaryEnabled: true,
  qrAccess: {
    profile: true,
    memories: true,
    gallery: true,
    audio: false,
  },
};

export const settingsService = {
  loadSettings: async () => {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!json) return defaultSettings;
      const parsed = JSON.parse(json);
      return {
        ...defaultSettings,
        ...parsed,
        qrAccess: {
          ...defaultSettings.qrAccess,
          ...(parsed.qrAccess || {}),
        },
      };
    } catch (error) {
      console.warn('Settings load failed:', error.message);
      return defaultSettings;
    }
  },

  saveSettings: async (settings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return { success: true };
    } catch (error) {
      console.warn('Settings save failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  updateSetting: async (key, value) => {
    const current = await settingsService.loadSettings();
    const updated = { ...current, [key]: value };
    return settingsService.saveSettings(updated);
  },

  getDefaultSettings: () => defaultSettings,
};
