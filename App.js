
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import QRCodeScreen from './src/screens/QRCodeScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import MemorialDetailScreen from './src/screens/MemorialDetailScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import SplashScreen from './src/screens/SplashScreen';
import StoryScreen from './src/screens/StoryScreen';
import StoryViewerScreen from './src/screens/StoryViewerScreen';
import PlaqueQRScreen from './src/screens/PlaqueQRScreen';

const linking = {
  prefixes: ['gonnotforgotten://'],
  config: {
    screens: {
      StoryViewer: {
        path: 'view-story',
      },
      UserProfile: {
        path: 'profile/:userId',
      },
    },
  },
};
import { authService } from './src/services';
import { supabase } from './src/config/supabase';
import { AuthContext } from './src/context/AuthContext';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const signingOut = useRef(false);

  const handleSignOut = useCallback(() => {
    console.log('[SignOut] button pressed — clearing user state immediately');
    signingOut.current = true;
    setUser(null);
    setShowSplash(false);

    authService.signOutUser()
      .then(() => console.log('[SignOut] storage cleared OK'))
      .catch((e) => console.warn('[SignOut] cleanup error (non-fatal):', e))
      .finally(() => {
        setTimeout(() => { signingOut.current = false; }, 500);
      });
  }, []);

  const handlePasswordReset = useCallback(async () => {
    // Sign out the recovery session so the user logs in fresh
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
    setRecoveryMode(false);
    setUser(null);
  }, []);

  // Handle incoming deep links (password recovery)
  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url || typeof url !== 'string') return;
      // Supabase puts tokens in the URL hash after redirecting
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return;
      const hash = url.slice(hashIndex + 1);
      const params = new URLSearchParams(hash);
      const type = params.get('type');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          setRecoveryMode(true);
        }
      }
    };

    // App opened via deep link
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });

    // App already running, deep link received
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unregister = authService.onAuthStateChange((currentUser) => {
      console.log('[AuthState] changed, signingOut=', signingOut.current, 'user=', currentUser?.email ?? null);
      if (signingOut.current) {
        console.log('[AuthState] ignored — sign-out in progress');
        return;
      }
      // Don't update user state when we're in recovery mode
      if (recoveryMode) return;
      setUser(currentUser);
      setInitializing(false);
    });
    return unregister;
  }, [recoveryMode]);

  // Once recoveryMode is set we can mark initializing done
  useEffect(() => {
    if (recoveryMode) setInitializing(false);
  }, [recoveryMode]);

  const authCtx = { signOut: handleSignOut, onPasswordReset: handlePasswordReset };

  if (initializing) {
    return (
      <AuthContext.Provider value={authCtx}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6cab90" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </AuthContext.Provider>
    );
  }

  if (showSplash && !user && !recoveryMode) {
    return (
      <AuthContext.Provider value={authCtx}>
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={authCtx}>
      <NavigationContainer linking={linking}>
        <Stack.Navigator key={recoveryMode ? 'recovery' : user ? 'app' : 'auth'} screenOptions={{ headerShown: false }}>
          {recoveryMode ? (
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          ) : user ? (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Gallery" component={GalleryScreen} />
              <Stack.Screen name="GenerateQR" component={QRCodeScreen} />
              <Stack.Screen name="ScanQR" component={QRScannerScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="Detail" component={MemorialDetailScreen} />
              <Stack.Screen name="Story" component={StoryScreen} />
              <Stack.Screen name="StoryViewer" component={StoryViewerScreen} />
              <Stack.Screen name="PlaqueQR" component={PlaqueQRScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="SignIn" component={SignInScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDE8E1',
  },
  loadingText: {
    marginTop: 12,
    color: '#8A827A',
    fontSize: 16,
  },
});
