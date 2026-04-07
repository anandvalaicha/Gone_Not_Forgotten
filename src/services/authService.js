import { auth, isFirebaseConfigured } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, updateProfile } from 'firebase/auth';

// Note: Google Sign-In with signInWithPopup may not work in React Native.
// For mobile, consider using expo-auth-session or react-native-google-signin.
// This is a placeholder for web or when properly configured.

const firebaseConfigError =
  'Firebase is not configured yet. Update src/config/firebase.js with your real Firebase project keys and enable Email/Password sign-in in Firebase Console.';

const DEMO_USER = {
  uid: 'demo-user-001',
  email: 'demo@gonenotforgotten.com',
  displayName: 'Demo User',
};

let demoSessionUser = null;
const demoAuthListeners = new Set();

const notifyDemoAuthListeners = () => {
  demoAuthListeners.forEach((listener) => listener(demoSessionUser));
};

export const authService = {
  // Email/Password Sign Up
  signUp: async (email, password) => {
    if (!isFirebaseConfigured) {
      if (email.trim().toLowerCase() === DEMO_USER.email && password === 'Demo@1234') {
        demoSessionUser = DEMO_USER;
        notifyDemoAuthListeners();
        return { success: true, user: DEMO_USER, demo: true };
      }
      return {
        success: false,
        error: `${firebaseConfigError}\n\nTemporary demo login:\nEmail: ${DEMO_USER.email}\nPassword: Demo@1234`,
      };
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Email/Password Sign In
  signIn: async (email, password) => {
    if (!isFirebaseConfigured) {
      if (email.trim().toLowerCase() === DEMO_USER.email && password === 'Demo@1234') {
        demoSessionUser = DEMO_USER;
        notifyDemoAuthListeners();
        return { success: true, user: DEMO_USER, demo: true };
      }
      return {
        success: false,
        error: `Use the temporary demo login for now:\nEmail: ${DEMO_USER.email}\nPassword: Demo@1234`,
      };
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Google Sign In (placeholder - may need different implementation for React Native)
  signInWithGoogle: async () => {
    if (!isFirebaseConfigured) {
      return { success: false, error: firebaseConfigError };
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Sign Out
  signOutUser: async () => {
    if (!isFirebaseConfigured) {
      demoSessionUser = null;
      notifyDemoAuthListeners();
      return { success: true };
    }

    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update the current user's profile (display name, photo URL, etc.)
  updateUserProfile: async (data) => {
    if (!isFirebaseConfigured) {
      if (!demoSessionUser) {
        return { success: false, error: firebaseConfigError };
      }
      demoSessionUser = { ...demoSessionUser, ...data };
      notifyDemoAuthListeners();
      return { success: true, user: demoSessionUser };
    }

    if (!auth?.currentUser) {
      return { success: false, error: 'No authenticated user available.' };
    }

    try {
      await updateProfile(auth.currentUser, data);
      return { success: true, user: auth.currentUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Listen to auth state changes
  onAuthStateChange: (callback) => {
    if (!isFirebaseConfigured || !auth) {
      demoAuthListeners.add(callback);
      callback(demoSessionUser);
      return () => demoAuthListeners.delete(callback);
    }
    try {
      return onAuthStateChanged(auth, callback);
    } catch (error) {
      console.warn('Auth state change error:', error.message);
      callback(demoSessionUser);
      return () => {};
    }
  },

  // Get current user
  getCurrentUser: () => {
    if (!isFirebaseConfigured || !auth) {
      return demoSessionUser;
    }
    return auth.currentUser;
  }
};