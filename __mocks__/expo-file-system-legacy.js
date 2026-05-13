const EncodingType = { Base64: 'base64', UTF8: 'utf8' };

module.exports = {
  EncodingType,
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  readAsStringAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
};
