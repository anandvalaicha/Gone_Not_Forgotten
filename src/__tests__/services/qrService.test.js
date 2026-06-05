jest.mock('react-native-qrcode-svg', () => 'QRCode');

const { qrService } = require('../../services/qrService');

describe('qrService.generateMemorialQR', () => {
  it('returns a URL containing the memorial ID', () => {
    const url = qrService.generateMemorialQR('mem-abc-123');
    expect(url).toContain('mem-abc-123');
  });

  it('returns a valid HTTPS URL', () => {
    const url = qrService.generateMemorialQR('mem-001');
    expect(url).toMatch(/^https:\/\//);
  });

  it('returns different URLs for different memorial IDs', () => {
    const url1 = qrService.generateMemorialQR('mem-001');
    const url2 = qrService.generateMemorialQR('mem-002');
    expect(url1).not.toBe(url2);
  });

  it('includes the expected domain', () => {
    const url = qrService.generateMemorialQR('any-id');
    expect(url).toContain('gonenotforgotten.app');
  });

  it('constructs the full expected URL format', () => {
    const url = qrService.generateMemorialQR('memorial-xyz');
    expect(url).toBe('https://gonenotforgotten.app/memorial/memorial-xyz');
  });
});
