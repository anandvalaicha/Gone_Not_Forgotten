// Firebase configuration
// TODO: Replace with your actual Firebase project config from Firebase Console
// Go to https://console.firebase.google.com/, create a project, and get the config
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Replace with your Firebase project config from Firebase Console
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

export const isFirebaseConfigured = !Object.values(firebaseConfig).some(
  (value) => typeof value === 'string' && value.includes('your-')
);

// Initialize Firebase services only if properly configured
let app;
let auth;
let db;
let storage;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.warn('Firebase initialization failed:', error.message);
  }
}

export { auth, db, storage };
export default app;