
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
import SplashScreen from './src/screens/SplashScreen';
import StoryScreen from './src/screens/StoryScreen';
import PlukQRScreen from './src/screens/PlukQRScreen';
import { authService } from './src/services';
import { AuthContext } from './src/context/AuthContext';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  // Guard: once sign-out starts, ignore any Supabase auth callbacks that
  // fire afterwards (e.g. from the autoRefreshToken timer).
  const signingOut = useRef(false);

  // Must be declared before any early returns (hook rules)
  const handleSignOut = useCallback(() => {
    console.log('[SignOut] button pressed — clearing user state immediately');
    // ── Synchronous: switch the navigator to the auth stack RIGHT NOW ──────
    // Do NOT await anything here. Setting user=null is enough to unmount the
    // app stack and render SignIn. Storage cleanup happens in the background.
    signingOut.current = true;
    setUser(null);
    setShowSplash(false); // go straight to login, no splash on sign-out

    // ── Background: clear AsyncStorage + reset supabase in-memory session ──
    authService.signOutUser()
      .then(() => console.log('[SignOut] storage cleared OK'))
      .catch((e) => console.warn('[SignOut] cleanup error (non-fatal):', e))
      .finally(() => {
        setTimeout(() => { signingOut.current = false; }, 500);
      });
  }, []);

  useEffect(() => {
    const unregister = authService.onAuthStateChange((currentUser) => {
      console.log('[AuthState] changed, signingOut=', signingOut.current, 'user=', currentUser?.email ?? null);
      // Drop any session restoration that arrives during/after sign-out
      if (signingOut.current) {
        console.log('[AuthState] ignored — sign-out in progress');
        return;
      }
      setUser(currentUser);
      setInitializing(false);
      // Do NOT reset showSplash here — SplashScreen calls onFinish itself
    });
    return unregister;
  }, []);

  if (initializing) {
    return (
      <AuthContext.Provider value={handleSignOut}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6cab90" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </AuthContext.Provider>
    );
  }

  if (showSplash && !user) {
    return (
      <AuthContext.Provider value={handleSignOut}>
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={handleSignOut}>
      <NavigationContainer>
      <Stack.Navigator key={user ? 'app' : 'auth'} screenOptions={{ headerShown: false }}>
        {user ? (
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
            <Stack.Screen name="PlukQR" component={PlukQRScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
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
