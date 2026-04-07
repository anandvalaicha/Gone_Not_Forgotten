import QRCode from 'react-native-qrcode-svg';

export const qrService = {
  // Generate QR code data (URL to memorial)
  generateMemorialQR: (memorialId) => {
    // Assuming the app has a web view or deep link to access memorial
    // For now, return a URL that could be used
    const memorialURL = `https://gonenotforgotten.app/memorial/${memorialId}`;
    return memorialURL;
  },

  // In a real app, you might want to store QR data in database
  // For now, this is just a utility
};