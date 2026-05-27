# Gone Not Forgotten

Gone Not Forgotten is a memorial app built with Expo and React Native. It helps users preserve loved ones’ memories by creating personalized memorial profiles with photos, videos, audio, stories, and shareable QR codes.

## Features

- User sign up and sign in
- Create and edit memorial profiles
- Add photos, videos, audio, and stories
- View memorial gallery and story details
- Generate QR codes for profile sharing
- Scan QR codes to open memorial profiles
- Manage app settings and content access

## Built With

- Expo
- React Native
- React Navigation
- Supabase
- react-native-qrcode-svg
- AsyncStorage
- Expo Camera, Media Library, Image Picker, Audio, Video

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/Gone_Not_Forgotten.git
   cd Gone_Not_Forgotten
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Running the App

- `npm run android` — start on Android emulator or device
- `npm run ios` — start on iOS simulator or device
- `npm run web` — start in a browser

## Configuration

This app uses Supabase for backend services. Update the Supabase configuration in `src/config/supabase.js` with your project values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

If you use environment variables or a separate config file, add your credentials before launching the app.

## Usage

- Open the app and sign up or sign in
- Create a memorial profile for a loved one
- Add photos, videos, audio, and story entries
- Use the QR screen to generate and share profile access
- Scan QR codes to open shared memorial profiles

## Testing

Run tests with:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

## Notes

- The app is built with Expo and supports iOS, Android, and web via Expo.
- Make sure your device/emulator has camera and media permissions enabled for QR scanning and media uploads.

## License

This project is private.
